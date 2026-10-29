import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-DO-NOT-USE-IN-PROD',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-DO-NOT-USE-IN-PROD',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  invitationExpiresInHours: parseInt(process.env.INVITATION_EXPIRES_IN_HOURS, 10) || 72,
}));
