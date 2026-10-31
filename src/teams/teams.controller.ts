import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Teams')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('organizations/:orgId/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all teams in organization (FR-TEAM-002)' })
  findAll(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.teamsService.findAll(orgId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team details' })
  findOne(
    @Param('orgId') orgId: string,
    @Param('id') teamId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.teamsService.findOne(orgId, teamId, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create team in organization (FR-TEAM-001)' })
  create(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamsService.create(orgId, userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team name or details (FR-TEAM-004)' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') teamId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<CreateTeamDto>,
  ) {
    return this.teamsService.update(orgId, teamId, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete team from organization' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') teamId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.teamsService.delete(orgId, teamId, userId);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign member to team (FR-TEAM-003)' })
  addMember(
    @Param('orgId') orgId: string,
    @Param('id') teamId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(orgId, teamId, userId, dto);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove member from team (FR-TEAM-003)' })
  removeMember(
    @Param('orgId') orgId: string,
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.teamsService.removeMember(orgId, teamId, userId, memberId);
  }
}
