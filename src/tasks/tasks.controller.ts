import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TaskStatus } from '@prisma/client';

@ApiTags('Tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('organizations/:orgId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List tasks in organization (can filter by projectId)' })
  findAll(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.tasksService.findAllByOrg(orgId, userId, projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task details by ID' })
  findOne(
    @Param('orgId') orgId: string,
    @Param('id') taskId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.findOne(orgId, taskId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new task' })
  create(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(orgId, userId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status' })
  updateStatus(
    @Param('orgId') orgId: string,
    @Param('id') taskId: string,
    @Body('status') status: TaskStatus,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.updateStatus(orgId, taskId, status, userId);
  }

  @Post(':id/subtasks')
  @ApiOperation({ summary: 'Add a subtask to a task' })
  addSubtask(
    @Param('orgId') orgId: string,
    @Param('id') taskId: string,
    @Body('title') title: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.addSubtask(orgId, taskId, title, userId);
  }

  @Patch(':id/subtasks/:subtaskId')
  @ApiOperation({ summary: 'Toggle subtask completion' })
  toggleSubtask(
    @Param('orgId') orgId: string,
    @Param('subtaskId') subtaskId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.toggleSubtask(orgId, subtaskId, userId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Post comment on task' })
  addComment(
    @Param('orgId') orgId: string,
    @Param('id') taskId: string,
    @Body('content') content: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.addComment(orgId, taskId, content, userId);
  }
}
