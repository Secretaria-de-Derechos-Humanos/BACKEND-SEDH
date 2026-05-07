import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string().valid('development', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),

  // Base de datos
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SCHEMA: Joi.string().default('public'),

  // JWT
  JWT_PRIVATE_KEY_PATH: Joi.string().required(),
  JWT_PUBLIC_KEY_PATH: Joi.string().required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  JWT_ISSUER: Joi.string().default('sedh-backend'),
  JWT_AUDIENCE: Joi.string().default('sedh-frontend'),

  // Sesión
  SESSION_SECRET: Joi.string().min(32).required(),
  SESSION_MAX_AGE: Joi.number().default(86400000),

  // Cifrado
  ENCRYPTION_KEY: Joi.string().length(64).required(),

  // CORS
  CORS_ORIGINS: Joi.string().required(),

  // Rate limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),
  THROTTLE_AUTH_LIMIT: Joi.number().default(5),
});
