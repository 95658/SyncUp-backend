import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationType } from '@prisma/client';
import { FcmService } from './fcm.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private fcmService: FcmService,
  ) {}

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async registerDeviceToken(userId: string, token: string, platform: string) {
    return this.prisma.userDeviceToken.upsert({
      where: { token },
      create: {
        userId,
        token,
        platform: platform.toUpperCase(),
      },
      update: {
        userId,
        platform: platform.toUpperCase(),
        updatedAt: new Date(),
      },
    });
  }

  async unregisterDeviceToken(userId: string, token: string) {
    return this.prisma.userDeviceToken.deleteMany({
      where: { userId, token },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notif) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    entityType?: string;
    entityId?: string;
  }) {
    const created = await this.prisma.notification.create({
      data,
    });

    // Send push notification asynchronously
    this.fcmService.sendPushToUsers([data.userId], {
      title: data.title,
      body: data.body || '',
      data: {
        id: created.id,
        type: data.type,
        entityType: data.entityType || '',
        entityId: data.entityId || '',
      },
    }).catch(() => {});

    return created;
  }
}
