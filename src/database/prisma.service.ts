import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected');
    } catch (err: any) {
      this.logger.warn('⚠️ Database connection warning: PostgreSQL is not reachable at localhost:5432. Backend is running in standalone mode.');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Use this for operations that need transaction safety
   * Wraps Prisma's $transaction with proper typing
   */
  async withTransaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn);
  }

  /**
   * Clean database for testing purposes only
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase can only be called in test environment');
    }
    // Tables ordered by dependency (children first)
    const tables = [
      'activity_logs', 'notifications', 'message_reactions', 'messages',
      'channel_members', 'channels', 'comments', 'task_assignees', 'subtasks',
      'tasks', 'project_members', 'projects', 'team_members', 'teams',
      'invitations', 'organization_members', 'organizations', 'users',
    ];
    for (const table of tables) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    }
  }
}
