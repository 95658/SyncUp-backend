import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class TasksService {
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
      throw new ForbiddenException('Access denied: not an active member of this organization');
    }
    return member;
  }

  async findAllByOrg(orgId: string, userId: string, projectId?: string) {
    await this.assertMember(orgId, userId);

    return this.prisma.task.findMany({
      where: {
        project: { organizationId: orgId },
        ...(projectId ? { projectId } : {}),
        parentId: null, // Only top-level tasks
      },
      include: {
        subtasks: true,
        assignees: true,
        labels: {
          include: { label: true },
        },
        attachments: true,
        _count: { select: { comments: true, subtasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orgId: string, taskId: string, userId: string) {
    await this.assertMember(orgId, userId);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        project: { organizationId: orgId },
      },
      include: {
        subtasks: { orderBy: { createdAt: 'asc' } },
        assignees: true,
        comments: {
          include: {
            author: { select: { id: true, fullName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        labels: { include: { label: true } },
        attachments: true,
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(orgId: string, userId: string, dto: CreateTaskDto) {
    await this.assertMember(orgId, userId);

    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, organizationId: orgId },
    });
    if (!project) throw new NotFoundException('Project not found in this organization');

    return this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        status: dto.status || 'TODO',
        priority: dto.priority || 'MEDIUM',
        dueDate: (() => {
          if (!dto.dueDate) return undefined;
          const parsed = new Date(dto.dueDate);
          return isNaN(parsed.getTime()) ? undefined : parsed;
        })(),
        assignees: dto.assigneeIds && dto.assigneeIds.length > 0 ? {
          create: dto.assigneeIds.map((uId) => ({ userId: uId })),
        } : undefined,
      },
      include: {
        assignees: true,
      },
    });
  }

  async updateStatus(orgId: string, taskId: string, status: TaskStatus, userId: string) {
    const member = await this.assertMember(orgId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { organizationId: orgId } },
    });
    if (!task) throw new NotFoundException('Task not found');

    // Requirements 24 & 37: Only PO, Org Owner, Admin, or QA can change status after IN_REVIEW (to DONE)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isOwnerOrAdmin = member.role === 'OWNER' || member.role === 'ADMIN' || user?.isPlatformOwner;
    const isQaOrProduct =
      user?.jobTitle?.toLowerCase().includes('qa') ||
      user?.jobTitle?.toLowerCase().includes('product') ||
      user?.jobTitle?.toLowerCase().includes('owner');

    if (status === TaskStatus.DONE && !isOwnerOrAdmin && !isQaOrProduct) {
      throw new ForbiddenException(
        'Approval restricted: Only Product Owners, Organization Owners, and QA can approve tasks to Done',
      );
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status },
    });
  }

  async addSubtask(orgId: string, taskId: string, title: string, userId: string) {
    await this.assertMember(orgId, userId);

    const parentTask = await this.prisma.task.findFirst({
      where: { id: taskId, project: { organizationId: orgId } },
    });
    if (!parentTask) throw new NotFoundException('Parent task not found');

    return this.prisma.task.create({
      data: {
        projectId: parentTask.projectId,
        parentId: taskId,
        title,
        status: TaskStatus.TODO,
      },
    });
  }

  async toggleSubtask(orgId: string, subtaskId: string, userId: string) {
    await this.assertMember(orgId, userId);

    const subtask = await this.prisma.task.findFirst({
      where: { id: subtaskId, project: { organizationId: orgId } },
    });
    if (!subtask) throw new NotFoundException('Subtask not found');

    const newStatus = subtask.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;

    return this.prisma.task.update({
      where: { id: subtaskId },
      data: { status: newStatus },
    });
  }

  async addComment(orgId: string, taskId: string, content: string, userId: string) {
    await this.assertMember(orgId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { organizationId: orgId } },
    });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.comment.create({
      data: {
        taskId,
        authorId: userId,
        content,
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
  }
}
