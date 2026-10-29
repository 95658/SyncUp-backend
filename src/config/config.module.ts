import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import authConfig from './auth.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import mailConfig from './mail.config';
import storageConfig from './storage.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, redisConfig, mailConfig, storageConfig],
      envFilePath: ['.env', '.env.local'],
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
