import { Injectable, ConflictException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrgMemberRole, InvitationTarget, InvitationStatus, OrganizationStatus, UserStatus, OrgMemberStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SuperAdminService implements OnModuleInit {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  async onModuleInit() {
    await this.backfillMissingOrgMembers();
  }

  private async backfillMissingOrgMembers() {
    try {
      const orgsWithoutMembers = await this.prisma.organization.findMany({
        where: {
          members: {
            none: {},
          },
        },
        include: {
          invitations: true,
        },
      });

      for (const org of orgsWithoutMembers) {
        const inv = org.invitations[0];
        if (!inv) continue;

        let user = await this.prisma.user.findUnique({
          where: { email: inv.email.toLowerCase().trim() },
        });

        if (!user) {
          const passHash = await bcrypt.hash(`${org.name.replace(/\s+/g, '')}#Admin2026!`, 12);
          user = await this.prisma.user.create({
            data: {
              email: inv.email.toLowerCase().trim(),
              fullName: 'Organization Admin',
              passwordHash: passHash,
              status: UserStatus.INACTIVE,
              jobTitle: 'Organization Owner & Administrator',
            },
          });
        }

        await this.prisma.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: OrgMemberRole.OWNER,
            status: OrgMemberStatus.ACTIVE,
          },
        });

        this.logger.log(`Backfilled admin member for organization "${org.name}" (${user.email})`);
      }
    } catch (err) {
      this.logger.warn(`Backfill missing org members skipped: ${err.message}`);
    }
  }

  async createOrganization(dto: CreateOrganizationDto, platformOwnerId: string) {
    const slug = dto.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Requirement 14: cannot create organization for the same owner by the same name
    const existingOrgForOwner = await this.prisma.organization.findFirst({
      where: {
        name: { equals: dto.name.trim(), mode: 'insensitive' },
        OR: [
          {
            invitations: {
              some: { email: dto.adminEmail.toLowerCase().trim() },
            },
          },
          {
            members: {
              some: {
                user: { email: dto.adminEmail.toLowerCase().trim() },
              },
            },
          },
        ],
      },
    });
    if (existingOrgForOwner) {
      throw new ConflictException(
        `Cannot create organization: An organization with the name "${dto.name}" already exists for owner ${dto.adminEmail}`,
      );
    }

    const existingSlug = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Organization with slug "${slug}" already exists`);
    }

    // Generate secure invitation token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          status: OrganizationStatus.ACTIVE,
        },
      });

      // Find or create admin user in INACTIVE status (waiting for invitation acceptance)
      let adminUser = await tx.user.findUnique({
        where: { email: dto.adminEmail.toLowerCase().trim() },
      });

      const initialPassword = `${dto.name.replace(/\s+/g, '')}#Admin2026!`;
      const passwordHash = await bcrypt.hash(initialPassword, 12);

      if (!adminUser) {
        adminUser = await tx.user.create({
          data: {
            email: dto.adminEmail.toLowerCase().trim(),
            fullName: dto.adminName.trim() || 'Organization Admin',
            passwordHash,
            status: UserStatus.INACTIVE, // Cannot login until invitation accepted
            jobTitle: 'Organization Owner & Administrator',
          },
        });
      }

      // Create OrganizationMember for this adminUser as OWNER
      await tx.organizationMember.create({
        data: {
          userId: adminUser.id,
          organizationId: org.id,
          role: OrgMemberRole.OWNER,
          status: OrgMemberStatus.ACTIVE,
        },
      });

      const invitation = await tx.invitation.create({
        data: {
          organizationId: org.id,
          email: dto.adminEmail.toLowerCase().trim(),
          role: OrgMemberRole.OWNER,
          target: InvitationTarget.ORG_ADMIN,
          tokenHash,
          expiresAt,
          invitedById: platformOwnerId,
          status: InvitationStatus.PENDING,
        },
      });

      // Create default general channel
      await tx.channel.create({
        data: {
          organizationId: org.id,
          name: 'general',
          type: 'PUBLIC',
          description: 'General discussion for all organization members',
        },
      });

      // Audit log (FR-AUD-001)
      await tx.activityLog.create({
        data: {
          organizationId: org.id,
          actorId: platformOwnerId,
          entityType: 'ORGANIZATION',
          entityId: org.id,
          action: 'created',
          metadata: { name: org.name, adminEmail: dto.adminEmail },
        },
      });

      return { org, invitation, adminUser };
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl', 'http://localhost:3000');
    const invitationLink = `${frontendUrl}/auth/accept-invitation?token=${rawToken}&org=${encodeURIComponent(result.org.name)}`;

    this.logger.log(`Created Organization: ${result.org.name} (${result.org.id})`);
    this.logger.log(`Generated Admin Invite Link: ${invitationLink}`);

    // Send official invitation email
    try {
      await this.mailService.sendOrganizationInvitation({
        to: dto.adminEmail.toLowerCase().trim(),
        orgName: result.org.name,
        invitationLink,
        expiresAt,
      });
    } catch (mailErr) {
      this.logger.error(`Could not send invitation email: ${mailErr.message}`);
    }

    return {
      organization: result.org,
      invitationLink,
      expiresAt,
    };
  }

  async findAllOrganizations() {
    return this.prisma.organization.findMany({
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
            teams: true,
            channels: true,
          },
        },
        members: {
          where: { role: OrgMemberRole.OWNER },
          include: {
            user: {
              select: { id: true, email: true, fullName: true, status: true },
            },
          },
        },
        invitations: {
          where: { status: InvitationStatus.PENDING },
          select: { id: true, email: true, role: true, expiresAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlatformAnalytics() {
    const [totalOrgs, activeOrgs, totalUsers, activeUsers, pendingInvitations, totalTasks] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { isPlatformOwner: false } }),
      this.prisma.user.count({ where: { isPlatformOwner: false, status: 'ACTIVE' } }),
      this.prisma.invitation.count({ where: { status: 'PENDING' } }),
      this.prisma.task.count(),
    ]);

    return {
      totalOrganizations: totalOrgs,
      activeOrganizations: activeOrgs,
      totalUsers,
      activeUsers,
      pendingInvitations,
      totalTasks,
      systemHealth: '100% Operational',
      // ERP financial statistics (stays $0 until real billing/payments are recorded)
      monthlyRecurringRevenue: 0,
      totalRevenue: 0,
      averageRevenuePerUser: 0,
      cashFlowGrowth: '0.0%',
    };
  }

  async updateOrganizationStatus(orgId: string, status: OrganizationStatus) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: { status },
    });

    // Requirement 15: In audit trail instead of status_changed add status name or action name
    await this.prisma.activityLog.create({
      data: {
        organizationId: orgId,
        entityType: 'ORGANIZATION',
        entityId: orgId,
        action: `Status changed to ${status}`,
        metadata: { status },
      },
    });

    return updated;
  }

  // Requirement 13: Change status of admin account
  async updateAdminStatus(adminUserId: string, status: any) {
    const user = await this.prisma.user.findUnique({ where: { id: adminUserId } });
    if (!user) throw new NotFoundException('Administrator account not found');

    const updated = await this.prisma.user.update({
      where: { id: adminUserId },
      data: { status },
    });

    const member = await this.prisma.organizationMember.findFirst({ where: { userId: adminUserId } });
    const firstOrg = await this.prisma.organization.findFirst();

    if (member || firstOrg) {
      await this.prisma.activityLog.create({
        data: {
          organizationId: member?.organizationId || firstOrg?.id || '',
          entityType: 'MEMBER',
          entityId: adminUserId,
          action: `Admin account status changed to ${status}`,
          metadata: { userId: adminUserId, status },
        },
      });
    }

    return updated;
  }

  // FR-PLAT-005: List all organization admins
  async findAllAdministrators() {
    return this.prisma.organizationMember.findMany({
      where: {
        role: { in: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN] },
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true, status: true, createdAt: true },
        },
        organization: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  // FR-PLAT-006: List all platform users
  async findAllPlatformUsers() {
    return this.prisma.user.findMany({
      where: { isPlatformOwner: false },
      select: {
        id: true,
        email: true,
        fullName: true,
        jobTitle: true,
        status: true,
        createdAt: true,
        orgMemberships: {
          include: {
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // FR-PLAT-007: List all platform invitations
  async findAllPlatformInvitations() {
    return this.prisma.invitation.findMany({
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resendPlatformInvitation(invitationId: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { organization: true },
    });
    if (!inv) throw new NotFoundException('Invitation not found');

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        tokenHash,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || this.config.get<string>('app.frontendUrl', 'http://localhost:3000');
    const invitationLink = `${frontendUrl}/auth/accept-invitation?token=${rawToken}&org=${encodeURIComponent(inv.organization.name)}`;

    await this.mailService.sendOrganizationInvitation({
      to: inv.email,
      orgName: inv.organization.name,
      invitationLink,
      expiresAt,
    }).catch(() => {});

    return {
      success: true,
      invitationLink,
      expiresAt,
      message: `Invitation resent to ${inv.email}`,
    };
  }

  async revokePlatformInvitation(invitationId: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!inv) throw new NotFoundException('Invitation not found');

    await this.prisma.invitation.delete({ where: { id: invitationId } });
    return { success: true, message: 'Invitation revoked successfully' };
  }

  // FR-AUD-001 & FR-AUD-002: Audit logs
  async findAuditLogs(limit = 100) {
    return this.prisma.activityLog.findMany({
      take: limit,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        actor: {
          select: { id: true, email: true, fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Delete Organization
  async deleteOrganization(orgId: string, platformOwnerId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              include: {
                orgMemberships: true,
              },
            },
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with id "${orgId}" not found`);
    }

    const membersToDelete = org.members;

    await this.prisma.$transaction(async (tx) => {
      // 1. Audit log before deleting org
      await tx.activityLog.create({
        data: {
          organizationId: org.id,
          actorId: platformOwnerId,
          entityType: 'ORGANIZATION',
          entityId: org.id,
          action: 'deleted',
          metadata: { name: org.name, slug: org.slug },
        },
      });

      // 2. Delete organization (cascades to members, channels, tasks, invitations, etc.)
      await tx.organization.delete({
        where: { id: orgId },
      });

      // 3. Clean up any users who only belonged to this deleted org and are not platform owners
      for (const m of membersToDelete) {
        if (!m.user.isPlatformOwner && m.user.orgMemberships.length <= 1) {
          await tx.user.delete({
            where: { id: m.user.id },
          }).catch(() => null);
        }
      }
    });

    this.logger.log(`Deleted Organization: ${org.name} (${orgId}) by platform owner ${platformOwnerId}`);
    return { success: true, message: `Organization "${org.name}" deleted successfully` };
  }
}
