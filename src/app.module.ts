import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// ─── Internal Modules ────────────────────────────────────────────────────────
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { TeamsModule } from './teams/teams.module';
import { ChannelsModule } from './channels/channels.module';
import { MessagesModule } from './messages/messages.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { CommentsModule } from './comments/comments.module';
import { FilesModule } from './files/files.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CalendarModule } from './calendar/calendar.module';
import { ActivityModule } from './activity/activity.module';
import { SearchModule } from './search/search.module';
import { SuperAdminModule } from './super-admin/super-admin.module';

@Module({
  imports: [
    // ─── Config (must be first) ────────────────────────────────────────────────
    AppConfigModule,

    // ─── Rate Limiting ─────────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 30,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // ─── Core ──────────────────────────────────────────────────────────────────
    DatabaseModule,
    MailModule,

    // ─── Feature Modules ───────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    ChannelsModule,
    MessagesModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    FilesModule,
    NotificationsModule,
    CalendarModule,
    ActivityModule,
    SearchModule,

    // ─── Super Admin (Platform Owner) ──────────────────────────────────────────
    SuperAdminModule,
  ],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
