import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
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

  async findByChannel(orgId: string, channelId: string, userId: string, limit = 50) {
    await this.assertMember(orgId, userId);

    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, organizationId: orgId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    return this.prisma.message.findMany({
      where: {
        channelId,
        parentId: null, // Top-level messages (threads fetched separately)
        deletedAt: null,
      },
      include: {
        author: {
          select: { id: true, fullName: true, avatarUrl: true, jobTitle: true },
        },
        reactions: true,
        attachments: {
          include: { file: true },
        },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async create(orgId: string, channelId: string, userId: string, dto: SendMessageDto) {
    await this.assertMember(orgId, userId);

    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, organizationId: orgId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    return this.prisma.message.create({
      data: {
        channelId,
        authorId: userId,
        content: dto.content,
        parentId: dto.parentId,
      },
      include: {
        author: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        reactions: true,
        attachments: { include: { file: true } },
      },
    });
  }

  async toggleReaction(orgId: string, messageId: string, userId: string, emoji: string) {
    await this.assertMember(orgId, userId);

    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        channel: { organizationId: orgId },
      },
    });
    if (!message) throw new NotFoundException('Message not found');

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    if (existing) {
      await this.prisma.messageReaction.delete({
        where: { id: existing.id },
      });
      return { action: 'removed', emoji };
    } else {
      await this.prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
      });
      return { action: 'added', emoji };
    }
  }

  async getThread(orgId: string, messageId: string, userId: string) {
    await this.assertMember(orgId, userId);

    const parent = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        channel: { organizationId: orgId },
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        reactions: true,
      },
    });
    if (!parent) throw new NotFoundException('Parent message not found');

    const replies = await this.prisma.message.findMany({
      where: { parentId: messageId, deletedAt: null },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        reactions: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { parent, replies };
  }
}
