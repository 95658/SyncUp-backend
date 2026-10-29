import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Calendar & Meetings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('organizations/:orgId/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('meetings')
  @ApiOperation({ summary: 'Get meetings for organization' })
  getMeetings(@Param('orgId') orgId: string) {
    return this.calendarService.getMeetingsByOrg(orgId);
  }

  @Post('meetings')
  @ApiOperation({ summary: 'Create new meeting (Organization Owner / Admin)' })
  createMeeting(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() body: any,
  ) {
    return this.calendarService.createMeeting(orgId, userId, {
      ...body,
      startTime: new Date(body.startTime || Date.now()),
      endTime: new Date(body.endTime || Date.now() + 3600000),
    });
  }
}
