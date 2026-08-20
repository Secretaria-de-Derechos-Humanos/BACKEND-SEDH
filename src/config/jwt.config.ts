import { registerAs } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export const jwtConfig = registerAs('jwt', () => {
  const privateKeyPath = path.resolve(
    process.cwd(),
    process.env.JWT_PRIVATE_KEY_PATH ?? 'keys/private.key',
  );

  const publicKeyPath = path.resolve(
    process.cwd(),
    process.env.JWT_PUBLIC_KEY_PATH ?? 'keys/public.key',
  );

  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`No existe la clave privada: ${privateKeyPath}`);
  }

  if (!fs.existsSync(publicKeyPath)) {
    throw new Error(`No existe la clave pública: ${publicKeyPath}`);
  }

  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

  return {
    privateKey,
    publicKey,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
    issuer: process.env.JWT_ISSUER ?? 'sedh-backend',
    audience: process.env.JWT_AUDIENCE ?? 'sedh-frontend',
    algorithm: 'RS256' as const,
  };
});
