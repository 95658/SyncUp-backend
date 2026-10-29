import { SetMetadata } from '@nestjs/common';
import { OrgMemberRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to specific organization roles.
 * @example
 * @Roles(OrgMemberRole.ADMIN, OrgMemberRole.OWNER)
 * @Delete(':id')
 * deleteOrg() { ... }
 */
export const Roles = (...roles: OrgMemberRole[]) => SetMetadata(ROLES_KEY, roles);
