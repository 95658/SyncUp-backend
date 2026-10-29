import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
  accessKey: process.env.STORAGE_ACCESS_KEY,
  secretKey: process.env.STORAGE_SECRET_KEY,
  bucket: process.env.STORAGE_BUCKET || 'syncup-files',
  region: process.env.STORAGE_REGION || 'us-east-1',
  publicUrl: process.env.STORAGE_PUBLIC_URL,
}));
