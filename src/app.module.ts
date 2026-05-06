import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { validationSchema } from './config/validation.schema';
import { DatabaseModule } from './shared/database/database.module';
import { CoreModule } from './core/core.module';

// === MÓDULOS DE NEGOCIO ===
import { RecursosHumanosModule } from './modules/recursos-humanos/recursos-humanos.module';

@Module({
  imports: [
    // ── Configuración global ─────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),

    // ── Rate Limiting global ─────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
            limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
          },
        ],
      }),
    }),

    // ── Base de datos ─────────────────────────────────────────────────────
    DatabaseModule,

    // ── Núcleo del sistema ────────────────────────────────────────────────
    CoreModule,

    // === MÓDULOS DE NEGOCIO ===
    RecursosHumanosModule,
  ],
  providers: [
    // Rate limiting aplicado globalmente
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
