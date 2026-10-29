import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PLATFORM_OWNER_KEY } from '../decorators/platform-owner.decorator';

/**
 * Ensures the authenticated user is the Platform Owner (Ahmed).
 * Used to protect Super Admin endpoints.
 */
@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPlatformOwnerOnly = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_OWNER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPlatformOwnerOnly) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user?.isPlatformOwner) {
      throw new ForbiddenException('This endpoint is restricted to Platform Owner only');
    }

    return true;
  }
}
