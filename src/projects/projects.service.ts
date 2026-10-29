import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

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
    if (!member || member.status !== 'ACTIVE') {
      throw new ForbiddenException('You must be an active member of this organization');
    }
    return member;
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
        members: {
          create: {
            memberId: member.id,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }
}
