import {
  Injectable, UnauthorizedException, BadRequestException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ─── Login ──────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      const pendingInv = await this.prisma.invitation.findFirst({
        where: { email: user.email.toLowerCase(), status: 'PENDING' },
      });
      if (pendingInv) {
        throw new UnauthorizedException(
          'Your account is pending activation. Please accept the invitation link sent to your email to set your password and activate your account.'
        );
      }
      throw new UnauthorizedException('Your account has been deactivated. Contact your admin.');
    }

    // Check if non-platform owner's organizations are all suspended or if invitation is pending
    if (!user.isPlatformOwner) {
      // Check if user has pending invitation that has not been accepted
      const pendingInvites = await this.prisma.invitation.findMany({
        where: {
          email: user.email.toLowerCase(),
          status: 'PENDING',
        },
      });

      const memberships = await this.prisma.organizationMember.findMany({
        where: { userId: user.id },
        include: { organization: true },
      });

      // If user has no active memberships or only pending invitations
      if (memberships.length === 0 && pendingInvites.length > 0) {
        throw new UnauthorizedException(
          'Please accept the invitation sent to your email to activate your account before logging in.'
        );
      }

      if (memberships.length > 0) {
        const allSuspended = memberships.every(
          (m) => m.organization && m.organization.status === 'SUSPENDED'
        );
        if (allSuspended) {
          throw new UnauthorizedException(
            'Your organization has been suspended by the platform administrator. Access is restricted.'
          );
        }
      }
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last active
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      isPlatformOwner: user.isPlatformOwner,
    });

    this.logger.log(`User ${user.email} logged in`);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        isPlatformOwner: user.isPlatformOwner,
      },
      ...tokens,
    };
  }

  // ─── Accept Invitation & Set Password ───────────────────────────────────────
  async acceptInvitation(dto: AcceptInvitationDto) {
    // Look up invitation by SHA-256 token hash
    const sha256Token = createHash('sha256').update(dto.token).digest('hex');

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256Token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or already used');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Invitation is ${invitation.status.toLowerCase()}`);
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired. Request a new one from your admin.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Create user + org membership atomically
    const result = await this.prisma.withTransaction(async (tx) => {
      // Check if user with this email already exists
      let user = await tx.user.findUnique({ where: { email: invitation.email } });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            fullName: dto.fullName,
            passwordHash,
            status: 'ACTIVE',
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            fullName: dto.fullName || user.fullName,
            passwordHash,
            status: 'ACTIVE',
          },
        });
      }

      // Upsert org membership (ensures pre-created owner member is activated)
      const membership = await tx.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: invitation.organizationId,
          },
        },
        create: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          status: 'ACTIVE',
        },
        update: {
          role: invitation.role,
          status: 'ACTIVE',
        },
      });

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return { user, membership };
    });

    const tokens = await this.generateTokens({
      sub: result.user.id,
      email: result.user.email,
      isPlatformOwner: result.user.isPlatformOwner,
    });

    this.logger.log(`Invitation accepted: ${invitation.email} joined ${invitation.organization.name}`);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        isPlatformOwner: result.user.isPlatformOwner,
      },
      ...tokens,
    };
  }

  // ─── Refresh Tokens ─────────────────────────────────────────────────────────
  async refreshTokens(userId: string, email: string, isPlatformOwner: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Access denied');
    }

    return this.generateTokens({ sub: userId, email, isPlatformOwner });
  }

  // ─── Change Password ─────────────────────────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: 'Password changed successfully' };
  }

  // ─── Logout (client-side token invalidation) ─────────────────────────────────
  async logout(userId: string) {
    this.logger.log(`User ${userId} logged out`);
    return { message: 'Logged out successfully' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  private async generateTokens(payload: JwtPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('auth.jwtSecret'),
        expiresIn: this.config.get<string>('auth.jwtExpiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('auth.jwtRefreshSecret'),
        expiresIn: this.config.get<string>('auth.jwtRefreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
