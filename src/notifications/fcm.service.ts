import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private firebaseApp: App | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    try {
      const existingApps = getApps();
      if (existingApps.length > 0) {
        this.firebaseApp = existingApps[0];
        return;
      }

      const serviceAccountPath = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
      const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID', 'syncup-cbcef');

      let credential: any = null;

      if (serviceAccountJson) {
        try {
          const parsed = JSON.parse(serviceAccountJson);
          credential = cert(parsed);
          this.logger.log('Firebase Admin initialized with inline service account JSON');
        } catch (e) {
          this.logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON', e);
        }
      } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        credential = cert(serviceAccountPath);
        this.logger.log(`Firebase Admin initialized with file: ${serviceAccountPath}`);
      } else {
        const localPath = path.resolve(process.cwd(), 'service-account.json');
        if (fs.existsSync(localPath)) {
          credential = cert(localPath);
          this.logger.log(`Firebase Admin initialized with local: ${localPath}`);
        }
      }

      if (credential) {
        this.firebaseApp = initializeApp({
          credential,
          projectId,
        });
        this.logger.log(`Firebase Cloud Messaging initialized for project: ${projectId}`);
      } else {
        this.logger.warn(
          'Firebase service account not found. FCM push notifications will run in mock/log mode. Provide FIREBASE_SERVICE_ACCOUNT_PATH or service-account.json to enable live push delivery.',
        );
      }
    } catch (err: any) {
      this.logger.error(`Error initializing Firebase Admin: ${err.message}`, err.stack);
    }
  }

  async sendPushToUsers(
    userIds: string[],
    payload: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<number> {
    if (!userIds || userIds.length === 0) return 0;

    const deviceRecords = await this.prisma.userDeviceToken.findMany({
      where: { userId: { in: userIds } },
    });

    if (deviceRecords.length === 0) {
      this.logger.log(`[FCM] No registered device tokens for users: [${userIds.join(', ')}]`);
      return 0;
    }

    const tokens = deviceRecords.map((d) => d.token);
    this.logger.log(`[FCM] Sending push "${payload.title}" to ${tokens.length} token(s)...`);

    if (!this.firebaseApp) {
      this.logger.log(`[FCM MOCK LOG] Title: ${payload.title} | Body: ${payload.body} | Targets: ${tokens.length} devices`);
      return tokens.length;
    }

    try {
      const messaging = getMessaging(this.firebaseApp);
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'syncup_notifications',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
          },
        },
      });

      this.logger.log(`[FCM] Multicast result: ${response.successCount} success, ${response.failureCount} failed`);

      // Cleanup stale / invalid tokens
      if (response.failureCount > 0) {
        const tokensToDelete: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const code = resp.error.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              tokensToDelete.push(tokens[idx]);
            }
          }
        });

        if (tokensToDelete.length > 0) {
          await this.prisma.userDeviceToken.deleteMany({
            where: { token: { in: tokensToDelete } },
          });
          this.logger.log(`[FCM] Cleaned up ${tokensToDelete.length} unregistered device tokens.`);
        }
      }

      return response.successCount;
    } catch (err: any) {
      this.logger.error(`[FCM] Failed to dispatch push notifications: ${err.message}`, err.stack);
      return 0;
    }
  }
}
