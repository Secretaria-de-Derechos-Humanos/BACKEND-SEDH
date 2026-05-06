import { registerAs } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export const jwtConfig = registerAs('jwt', () => {
  const privateKeyPath = path.resolve(process.env.JWT_PRIVATE_KEY_PATH ?? './keys/private.key');
  const publicKeyPath = path.resolve(process.env.JWT_PUBLIC_KEY_PATH ?? './keys/public.key');

  return {
    privateKey: fs.existsSync(privateKeyPath) ? fs.readFileSync(privateKeyPath, 'utf-8') : '',
    publicKey: fs.existsSync(publicKeyPath) ? fs.readFileSync(publicKeyPath, 'utf-8') : '',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
    algorithm: 'RS256' as const,
  };
});
