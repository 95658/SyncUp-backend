import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { OrgMemberRole, OrgMemberStatus } from '@prisma/client';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  private async assertMember(orgId: string, userId: string, allowedRoles?: OrgMemberRole[]) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId,
        },
      },
    });

    if (member && member.status === 'ACTIVE') {
      if (allowedRoles && !allowedRoles.includes(member.role)) {
        throw new ForbiddenException(`Requires one of these roles: ${allowedRoles.join(', ')}`);
      }
      return member;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.isPlatformOwner) {
      return { id: 'platform-owner', userId, organizationId: orgId, role: OrgMemberRole.OWNER, status: OrgMemberStatus.ACTIVE } as any;
    }

    throw new ForbiddenException('You are not an active member of this organization');
  }

  async findAll(orgId: string, userId: string) {
    await this.assertMember(orgId, userId);

    return this.prisma.team.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { members: true, projects: true } },
        members: {
          include: {
            member: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, avatarUrl: true, jobTitle: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orgId: string, teamId: string, userId: string) {
    await this.assertMember(orgId, userId);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId: orgId },
      include: {
        _count: { select: { members: true, projects: true } },
        members: {
          include: {
            member: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, avatarUrl: true, jobTitle: true },
                },
              },
            },
          },
        },
        projects: {
          include: {
            project: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });

    if (!team) throw new NotFoundException('Team not found in this organization');
    return team;
  }

  async create(orgId: string, userId: string, dto: CreateTeamDto) {
    await this.assertMember(orgId, userId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    const existing = await this.prisma.team.findFirst({
      where: {
        organizationId: orgId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new ConflictException(`Team with name "${dto.name}" already exists in this organization`);
    }

    return this.prisma.team.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
      include: {
        _count: { select: { members: true, projects: true } },
        members: true,
      },
    });
  }

  async update(orgId: string, teamId: string, userId: string, dto: Partial<CreateTeamDto>) {
    await this.assertMember(orgId, userId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId: orgId },
    });
    if (!team) throw new NotFoundException('Team not found');

    if (dto.name && dto.name.trim() !== team.name) {
      const existing = await this.prisma.team.findFirst({
        where: {
          organizationId: orgId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: teamId },
        },
      });
      if (existing) {
        throw new ConflictException(`Another team with name "${dto.name}" already exists`);
      }
    }

    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description?.trim() : undefined,
      },
      include: {
        _count: { select: { members: true, projects: true } },
        members: {
          include: {
            member: {
              include: {
                user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });
  }

  async delete(orgId: string, teamId: string, userId: string) {
    await this.assertMember(orgId, userId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId: orgId },
    });
    if (!team) throw new NotFoundException('Team not found');

    await this.prisma.team.delete({
      where: { id: teamId },
    });

    return { message: 'Team deleted successfully' };
  }

  async addMember(orgId: string, teamId: string, userId: string, dto: AddTeamMemberDto) {
    await this.assertMember(orgId, userId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId: orgId },
    });
    if (!team) throw new NotFoundException('Team not found');

    const targetOrgMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        OR: [{ id: dto.memberId }, { userId: dto.memberId }],
      },
      include: { user: true },
    });

    if (!targetOrgMember) {
      throw new NotFoundException('Member does not belong to this organization');
    }

    const existing = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        memberId: targetOrgMember.id,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.teamMember.create({
      data: {
        teamId,
        memberId: targetOrgMember.id,
      },
      include: {
        member: {
          include: {
            user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  async removeMember(orgId: string, teamId: string, userId: string, memberIdOrUserId: string) {
    await this.assertMember(orgId, userId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId: orgId },
    });
    if (!team) throw new NotFoundException('Team not found');

    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        OR: [
          { id: memberIdOrUserId },
          { memberId: memberIdOrUserId },
          { member: { userId: memberIdOrUserId } },
        ],
      },
    });

    if (!teamMember) {
      throw new NotFoundException('Member is not in this team');
    }

    await this.prisma.teamMember.delete({
      where: { id: teamMember.id },
    });

    return { message: 'Member removed from team successfully' };
  }
}
