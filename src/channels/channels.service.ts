import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';

@Injectable()
export class ChannelsService {
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

    throw new ForbiddenException('Access denied: not an active member of this organization');
  }

  async findAllByOrg(orgId: string, userId: string) {
    await this.assertMember(orgId, userId);

    return this.prisma.channel.findMany({
      where: {
        organizationId: orgId,
        isArchived: false,
      },
      include: {
        _count: { select: { members: true, messages: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(orgId: string, userId: string, dto: CreateChannelDto) {
    const member = await this.assertMember(orgId, userId);

    const channelName = dto.name.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '');

    const existing = await this.prisma.channel.findFirst({
      where: { organizationId: orgId, name: channelName },
    });
    if (existing) {
      throw new ConflictException(`Channel #${channelName} already exists in this organization`);
    }

    return this.prisma.channel.create({
      data: {
        organizationId: orgId,
        name: channelName,
        description: dto.description,
        type: dto.type || 'PUBLIC',
        projectId: dto.projectId,
        members: {
          create: {
            orgMemberId: member.id,
          },
        },
      },
      include: {
        _count: { select: { members: true } },
      },
    });
  }
}
