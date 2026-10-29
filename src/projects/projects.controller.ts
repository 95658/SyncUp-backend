import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('organizations/:orgId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all projects in organization' })
  findAll(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.projectsService.findAll(orgId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project details' })
  findOne(
    @Param('orgId') orgId: string,
    @Param('id') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projectsService.findOne(orgId, projectId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new project in organization' })
  create(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(orgId, userId, dto);
  }
}
