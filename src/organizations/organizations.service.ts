import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgMemberRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ─── Get Organizations for Current User ────────────────────────────────────
  async getUserOrganizations(userId: string, isPlatformOwner = false) {
    if (isPlatformOwner) {
      return this.prisma.organization.findMany({
        include: {
          members: {
            include: {
              user: {
                select: { id: true, fullName: true, email: true, avatarUrl: true },
              },
            },
          },
          _count: { select: { members: true, projects: true, channels: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        organization: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, avatarUrl: true },
                },
              },
            },
            _count: { select: { members: true, projects: true, channels: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      ...m.organization,
      myRole: m.role,
    }));
  }

  // ─── Get Org (with permission check) ────────────────────────────────────────
  async findOne(orgId: string, userId: string) {
    await this.assertMembership(orgId, userId);
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { _count: { select: { members: true, projects: true, teams: true } } },
    });
  }

  // ─── Get Members ─────────────────────────────────────────────────────────────
  async getMembers(orgId: string, userId: string) {
    await this.assertMembership(orgId, userId);

    return this.prisma.organizationMember.findMany({
      where: { organizationId: orgId, status: { not: 'REMOVED' } },
      include: {
        user: {
          select: {
            id: true, email: true, fullName: true,
            avatarUrl: true, jobTitle: true, lastActiveAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  // ─── Invite Member ────────────────────────────────────────────────────────────
  async inviteMember(orgId: string, inviterId: string, dto: CreateInvitationDto) {
    // Only OWNER or ADMIN can invite
    const inviterMembership = await this.assertMembership(orgId, inviterId, [
      OrgMemberRole.OWNER, OrgMemberRole.ADMIN,
    ]);

    // ADMIN cannot invite another OWNER
    if (dto.role === OrgMemberRole.OWNER && inviterMembership.role !== OrgMemberRole.OWNER) {
      throw new ForbiddenException('Only the Organization Owner can invite another Owner');
    }

    // Check if user already a member
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      const alreadyMember = await this.prisma.organizationMember.findFirst({
        where: { userId: existingUser.id, organizationId: orgId, status: 'ACTIVE' },
      });
      if (alreadyMember) throw new ConflictException('User is already a member of this organization');
    }

    // Check for pending invitation
    const existingInvite = await this.prisma.invitation.findFirst({
      where: { organizationId: orgId, email: dto.email, status: 'PENDING' },
    });
    if (existingInvite) throw new ConflictException('A pending invitation already exists for this email');

    // Generate secure token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresInHours = this.config.get<number>('auth.invitationExpiresInHours', 72);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        teamId: dto.teamId,
        invitedById: inviterId,
        tokenHash,
        target: 'ORG_MEMBER',
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      },
      include: { organization: true },
    });

    this.logger.log(`Invitation sent to ${dto.email} for org ${orgId}`);

    // TODO: Send invitation email via MailService
    // The email should contain: rawToken (never stored, only used once)
    // Link: ${frontendUrl}/auth/accept-invitation?token=${rawToken}

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      // Return rawToken only in development for testing
      ...(this.config.get('app.nodeEnv') === 'development' && { devToken: rawToken }),
    };
  }

  // ─── Get Pending Invitations ──────────────────────────────────────────────────
  async getInvitations(orgId: string, userId: string) {
    await this.assertMembership(orgId, userId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    return this.prisma.invitation.findMany({
      where: { organizationId: orgId, status: 'PENDING' },
      include: {
        invitedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Revoke Invitation ────────────────────────────────────────────────────────
  async revokeInvitation(orgId: string, invitationId: string, userId: string) {
    await this.assertMembership(orgId, userId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'PENDING') {
      throw new ConflictException(`Cannot revoke a ${invitation.status.toLowerCase()} invitation`);
    }

    return this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });
  }

  // ─── Update Member Role ───────────────────────────────────────────────────────
  async updateMemberRole(orgId: string, memberId: string, actorId: string, dto: UpdateMemberRoleDto) {
    const actor = await this.assertMembership(orgId, actorId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    if (dto.role === OrgMemberRole.OWNER && actor.role !== OrgMemberRole.OWNER) {
      throw new ForbiddenException('Only the Organization Owner can assign the Owner role');
    }

    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId },
    });
    if (!member) throw new NotFoundException('Member not found in this organization');

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: dto.role },
    });
  }

  // ─── Remove Member ─────────────────────────────────────────────────────────────
  async removeMember(orgId: string, memberId: string, actorId: string) {
    await this.assertMembership(orgId, actorId, [OrgMemberRole.OWNER, OrgMemberRole.ADMIN]);

    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === OrgMemberRole.OWNER) {
      throw new ForbiddenException('Cannot remove the Organization Owner');
    }

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { status: 'REMOVED' },
    });
  }

  // ─── Helper: Assert Membership ────────────────────────────────────────────────
  async assertMembership(orgId: string, userId: string, allowedRoles?: OrgMemberRole[]) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { organizationId: orgId, userId, status: 'ACTIVE' },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of these roles: ${allowedRoles.join(', ')}`,
      );
    }

    return membership;
  }
}
