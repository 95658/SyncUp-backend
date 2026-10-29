import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        jobTitle: true,
        phone: true,
        timezone: true,
        language: true,
        status: true,
        isPlatformOwner: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        jobTitle: true,
        phone: true,
        timezone: true,
        language: true,
      },
    });
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
  }

  /**
   * Get all members visible to a user within an organization.
   */
  async getOrgMembers(organizationId: string, currentUserId: string) {
    // Verify the current user belongs to this org
    const membership = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: currentUserId, status: 'ACTIVE' },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this organization');

    return this.prisma.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
            jobTitle: true,
            lastActiveAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }
}
