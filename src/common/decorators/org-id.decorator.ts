import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the organization ID from the request params or authenticated user.
 * Useful when a user's org context is needed.
 */
export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.params.organizationId || request.user?.organizationId;
  },
);
