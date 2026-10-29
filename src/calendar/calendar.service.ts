import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getMeetingsByOrg(orgId: string) {
    return this.prisma.meeting.findMany({
      where: { organizationId: orgId },
      include: {
        participants: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async createMeeting(orgId: string, userId: string, data: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    externalLink?: string;
    participantUserIds?: string[];
  }) {
    return this.prisma.meeting.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        externalLink: data.externalLink,
        participants: data.participantUserIds && data.participantUserIds.length > 0 ? {
          create: data.participantUserIds.map((pId) => ({ userId: pId })),
        } : undefined,
      },
      include: {
        participants: true,
      },
    });
  }
}
