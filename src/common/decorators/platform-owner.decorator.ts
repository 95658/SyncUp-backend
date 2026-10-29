import { SetMetadata } from '@nestjs/common';

export const IS_PLATFORM_OWNER_KEY = 'isPlatformOwner';

/**
 * Restrict a route to Platform Owner only (Ahmed / Super Admin).
 * @example
 * @PlatformOwnerOnly()
 * @Post('organizations')
 * createOrg() { ... }
 */
export const PlatformOwnerOnly = () => SetMetadata(IS_PLATFORM_OWNER_KEY, true);
