import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // ─── Global Prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─── API Versioning ─────────────────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ─── CORS ───────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      configService.get<string>('FRONTEND_URL'),
      'http://localhost:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ─── WebSocket Adapter ──────────────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ─── Global Pipes ───────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true,           // Auto-transform to DTO types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─── Global Interceptors ────────────────────────────────────────────────────
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ─── Swagger Documentation ──────────────────────────────────────────────────
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SyncUp API')
      .setDescription(
        'SyncUp - Private B2B SaaS Platform API\n\n' +
        'All endpoints require authentication except: POST /auth/login, POST /auth/accept-invitation',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .addTag('Auth', 'Authentication & invitation flow')
      .addTag('Users', 'User profile management')
      .addTag('Organizations', 'Organization management')
      .addTag('Teams', 'Team management within organizations')
      .addTag('Channels', 'Chat channels & direct messages')
      .addTag('Messages', 'Real-time messages')
      .addTag('Projects', 'Project management')
      .addTag('Tasks', 'Task management')
      .addTag('Comments', 'Comments on tasks')
      .addTag('Files', 'File upload & management')
      .addTag('Notifications', 'In-app notifications')
      .addTag('Calendar', 'Meetings & events')
      .addTag('Search', 'Global search')
      .addTag('Super Admin', 'Platform owner endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // ─── Start Server ───────────────────────────────────────────────────────────
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`\n🚀 SyncUp API is running on: http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger docs:             http://localhost:${port}/api/docs\n`);
}

bootstrap();
