import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(','),
  swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
  encryptionKey: process.env.ENCRYPTION_KEY,
}));
