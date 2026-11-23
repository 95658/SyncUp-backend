import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SuperAdminService } from './super-admin.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformOwnerGuard } from '../common/guards/platform-owner.guard';
import { PlatformOwnerOnly } from '../common/decorators/platform-owner.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrganizationStatus } from '@prisma/client';

@ApiTags('Super Admin')
@UseGuards(JwtAuthGuard, PlatformOwnerGuard)
@PlatformOwnerOnly()
@ApiBearerAuth('access-token')
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post('organizations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization & invite its Admin (Platform Owner only)' })
  @ApiResponse({ status: 201, description: 'Organization created and invitation link returned' })
  createOrganization(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser('id') platformOwnerId: string,
  ) {
    return this.superAdminService.createOrganization(dto, platformOwnerId);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations on the platform' })
  getAllOrganizations() {
    return this.superAdminService.findAllOrganizations();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Platform-wide usage overview & metrics' })
  getAnalytics() {
    return this.superAdminService.getPlatformAnalytics();
  }

  @Patch('organizations/:id/status')
  @ApiOperation({ summary: 'Update organization status (e.g. SUSPENDED or ACTIVE)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrganizationStatus,
  ) {
    return this.superAdminService.updateOrganizationStatus(id, status);
  }

  @Delete('organizations/:id')
  @ApiOperation({ summary: 'Delete an organization (Platform Owner only)' })
  deleteOrganization(
    @Param('id') id: string,
    @CurrentUser('id') platformOwnerId: string,
  ) {
    return this.superAdminService.deleteOrganization(id, platformOwnerId);
  }

  @Get('administrators')
  @ApiOperation({ summary: 'List all organization admins across platform (FR-PLAT-005)' })
  getAdministrators() {
    return this.superAdminService.findAllAdministrators();
  }

  @Patch('administrators/:id/status')
  @ApiOperation({ summary: 'Change status of admin account (Requirement 13)' })
  updateAdminStatus(
    @Param('id') adminUserId: string,
    @Body('status') status: any,
  ) {
    return this.superAdminService.updateAdminStatus(adminUserId, status);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all registered platform users (FR-PLAT-006)' })
  getPlatformUsers() {
    return this.superAdminService.findAllPlatformUsers();
  }

  @Get('invitations')
  @ApiOperation({ summary: 'List all platform invitations (FR-PLAT-007)' })
  getPlatformInvitations() {
    return this.superAdminService.findAllPlatformInvitations();
  }

  @Post('invitations/:id/resend')
  @ApiOperation({ summary: 'Resend platform invitation and return fresh link' })
  resendInvitation(@Param('id') id: string) {
    return this.superAdminService.resendPlatformInvitation(id);
  }

  @Delete('invitations/:id')
  @ApiOperation({ summary: 'Revoke platform invitation' })
  revokeInvitation(@Param('id') id: string) {
    return this.superAdminService.revokePlatformInvitation(id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Audit logs of administrative actions (FR-AUD-001/002)' })
  getAuditLogs(@Query('limit') limit?: number) {
    return this.superAdminService.findAuditLogs(limit ? Number(limit) : 100);
  }
}
