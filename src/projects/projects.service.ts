import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private async assertMember(orgId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId,
        },
      },
    });
    if (member && member.status === 'ACTIVE') {
      return member;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.isPlatformOwner) {
      return { id: 'platform-owner', userId, organizationId: orgId, role: 'OWNER', status: 'ACTIVE' } as any;
    }

    throw new ForbiddenException('You must be an active member of this organization');
  }

  async findAll(orgId: string, userId: string) {
    const member = await this.assertMember(orgId, userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isOwnerOrAdmin = member.role === 'OWNER' || member.role === 'ADMIN' || user?.isPlatformOwner;

    // Requirement 35: Standard members can only access projects they are invited to
    return this.prisma.project.findMany({
      where: {
        organizationId: orgId,
        ...(isOwnerOrAdmin
          ? {}
          : {
              members: {
                some: { memberId: member.id },
              },
            }),
      },
      include: {
        _count: { select: { tasks: true, members: true } },
        members: {
          include: {
            member: {
              include: {
                user: { select: { id: true, fullName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orgId: string, projectId: string, userId: string) {
    await this.assertMember(orgId, userId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      include: {
        members: {
          include: {
            member: {
              include: {
                user: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
              },
            },
          },
        },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(orgId: string, userId: string, dto: CreateProjectDto) {
    const member = await this.assertMember(orgId, userId);

    return this.prisma.project.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        status: dto.status || 'ACTIVE',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        ...(member.id !== 'platform-owner'
          ? {
              members: {
                create: {
                  memberId: member.id,
                },
              },
            }
          : {}),
      },
      include: {
        members: true,
      },
    });
  }

  async getMembers(orgId: string, projectId: string, userId: string) {
    await this.assertMember(orgId, userId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        member: {
          include: {
            user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  async addMember(orgId: string, projectId: string, userId: string, dto: AddProjectMemberDto) {
    const callerMember = await this.assertMember(orgId, userId);
    const callerUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const isOwnerOrAdmin = callerMember.role === 'OWNER' || callerMember.role === 'ADMIN' || callerUser?.isPlatformOwner;
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Only organization administrators can add members to projects');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) throw new NotFoundException('Project not found in this organization');

    // Find target organization member by OrgMember ID or User ID
    const targetMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { id: dto.memberId },
          { userId: dto.memberId },
        ],
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
    });

    if (!targetMember) {
      throw new NotFoundException('Target member is not part of this organization');
    }

    if (targetMember.status !== 'ACTIVE') {
      throw new ForbiddenException('Cannot assign an inactive or suspended member to a project');
    }

    // Check if already a member
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_memberId: {
          projectId,
          memberId: targetMember.id,
        },
      },
      include: {
        member: {
          include: {
            user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        memberId: targetMember.id,
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

  async removeMember(orgId: string, projectId: string, userId: string, memberIdOrUserId: string) {
    const callerMember = await this.assertMember(orgId, userId);
    const callerUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const isOwnerOrAdmin = callerMember.role === 'OWNER' || callerMember.role === 'ADMIN' || callerUser?.isPlatformOwner;
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Only organization administrators can remove members from projects');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) throw new NotFoundException('Project not found in this organization');

    // Find the project member record by ProjectMember id or OrganizationMember id or userId
    const projectMember = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        OR: [
          { id: memberIdOrUserId },
          { memberId: memberIdOrUserId },
          { member: { userId: memberIdOrUserId } },
        ],
      },
    });

    if (!projectMember) {
      throw new NotFoundException('Project member not found');
    }

    await this.prisma.projectMember.delete({
      where: { id: projectMember.id },
    });

    return { message: 'Member removed from project successfully' };
  }
}
