import { Controller, Get, Post, Delete, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM device push token' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Platform (IOS, ANDROID, WEB)', default: 'MOBILE' })
  @IsString()
  @IsOptional()
  platform?: string;
}

class UnregisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM device push token to remove' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

@ApiTags('Notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications' })
  getMyNotifications(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Post('device-token')
  @ApiOperation({ summary: 'Register FCM device push token' })
  registerDeviceToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.notificationsService.registerDeviceToken(
      userId,
      dto.token,
      dto.platform || 'ANDROID',
    );
  }

  @Delete('device-token')
  @ApiOperation({ summary: 'Unregister FCM device push token' })
  unregisterDeviceToken(
    @CurrentUser('id') userId: string,
    @Body() dto: UnregisterDeviceTokenDto,
  ) {
    return this.notificationsService.unregisterDeviceToken(userId, dto.token);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark single notification as read' })
  markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }
}
