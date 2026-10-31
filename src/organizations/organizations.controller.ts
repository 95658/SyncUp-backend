import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrgSettingsDto } from './dto/update-org-settings.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('organizations')
export class OrganizationsController {
  constructor(private orgsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all organizations belonging to current user' })
  getMyOrganizations(@CurrentUser() user: any) {
    return this.orgsService.getUserOrganizations(user.id, user.isPlatformOwner);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.orgsService.findOne(orgId, userId);
  }

  // ─── Settings ─────────────────────────────────────────────────────────────────

  @Get(':orgId/settings')
  @ApiOperation({ summary: 'Get organization settings and workflow defaults' })
  getSettings(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.orgsService.getSettings(orgId, userId);
  }

  @Patch(':orgId/settings')
  @ApiOperation({ summary: 'Update organization settings (Owner/Admin only)' })
  updateSettings(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOrgSettingsDto,
  ) {
    return this.orgsService.updateSettings(orgId, userId, dto);
  }

  // ─── Members ──────────────────────────────────────────────────────────────────

  @Get(':orgId/members')
  @ApiOperation({ summary: 'Get all organization members' })
  getMembers(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.orgsService.getMembers(orgId, userId);
  }

  @Patch(':orgId/members/:memberId/role')
  @ApiOperation({ summary: 'Update a member role (Admin/Owner only)' })
  updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.orgsService.updateMemberRole(orgId, memberId, userId, dto);
  }

  @Patch(':orgId/members/:memberId/status')
  @ApiOperation({ summary: 'Update member status (ACTIVE or SUSPENDED) (Admin/Owner only)' })
  updateMemberStatus(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @Body('status') status: string,
  ) {
    return this.orgsService.updateMemberStatus(orgId, memberId, userId, status);
  }

  @Delete(':orgId/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from organization (Admin/Owner only)' })
  removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.orgsService.removeMember(orgId, memberId, userId);
  }

  // ─── Invitations ──────────────────────────────────────────────────────────────

  @Post(':orgId/invitations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new member (Admin/Owner only)' })
  inviteMember(
    @Param('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.orgsService.inviteMember(orgId, userId, dto);
  }

  @Get(':orgId/invitations')
  @ApiOperation({ summary: 'Get pending invitations (Admin/Owner only)' })
  getInvitations(@Param('orgId') orgId: string, @CurrentUser('id') userId: string) {
    return this.orgsService.getInvitations(orgId, userId);
  }

  @Delete(':orgId/invitations/:invitationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending invitation (Admin/Owner only)' })
  revokeInvitation(
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.orgsService.revokeInvitation(orgId, invitationId, userId);
  }
}
