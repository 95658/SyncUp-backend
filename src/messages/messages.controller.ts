import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessagesGateway } from './messages.gateway';

@ApiTags('Messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('organizations/:orgId')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Get('channels/:channelId/messages')
  @ApiOperation({ summary: 'Get messages for a channel' })
  getMessages(
    @Param('orgId') orgId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.messagesService.findByChannel(orgId, channelId, userId, limit ? Number(limit) : 50);
  }

  @Post('channels/:channelId/messages')
  @ApiOperation({ summary: 'Send message to a channel' })
  async sendMessage(
    @Param('orgId') orgId: string,
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messagesService.create(orgId, channelId, userId, dto);

    // Broadcast in real-time to channel room via WebSockets
    this.messagesGateway.server
      .to(`channel:${channelId}`)
      .emit('newMessage', message);

    return message;
  }

  @Post('messages/:messageId/reactions')
  @ApiOperation({ summary: 'Add or remove an emoji reaction on a message' })
  async toggleReaction(
    @Param('orgId') orgId: string,
    @Param('messageId') messageId: string,
    @Body('emoji') emoji: string,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.messagesService.toggleReaction(orgId, messageId, userId, emoji);

    // Broadcast reaction update
    this.messagesGateway.server.emit('reactionUpdated', {
      messageId,
      userId,
      ...result,
    });

    return result;
  }

  @Get('messages/:messageId/thread')
  @ApiOperation({ summary: 'Get thread replies for a message' })
  getThread(
    @Param('orgId') orgId: string,
    @Param('messageId') messageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.messagesService.getThread(orgId, messageId, userId);
  }
}
