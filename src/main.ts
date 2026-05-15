import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';

function normalizarOrigen(origen: string): string {
  try {
    return new URL(origen).origin;
  } catch {
    return origen.trim().replace(/\/+$/, '');
  }
}

function construirPatronOrigen(origenConfig: string): RegExp | string {
  const origenNormalizado = normalizarOrigen(origenConfig);

  if (!origenNormalizado.includes('*')) {
    return origenNormalizado;
  }

  const origenEscapado = origenNormalizado
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^.\\/]+');

  return new RegExp(`^${origenEscapado}$`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // ── Seguridad ────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cookieParser());


  // ── CORS ─────────────────────────────────────────────────────────────────
  const originsConfig = config
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);

  const permitirCualquierOrigen = originsConfig.includes('*');
  const allowedOrigins = originsConfig
    .filter((origen) => origen !== '*')
    .map((origen) => construirPatronOrigen(origen));

  const originsParaLog = allowedOrigins.map((origenConfig) => (
    origenConfig instanceof RegExp
      ? origenConfig.toString()
      : origenConfig
  ));

  console.log(`[CORS] Origenes permitidos: ${originsParaLog.join(', ') || '(ninguno)'}`);

  app.enableCors({
    origin: (origenSolicitud, callback) => {
      // Permite clientes no navegador (sin header Origin) como health checks o Postman.
      if (!origenSolicitud) {
        return callback(null, true);
      }

      const origenNormalizado = normalizarOrigen(origenSolicitud);
      const origenPermitido = allowedOrigins.some((origenConfig) => {
        if (origenConfig instanceof RegExp) {
          return origenConfig.test(origenNormalizado);
        }

        return origenConfig === origenNormalizado;
      });

      if (
        permitirCualquierOrigen
        || origenPermitido
      ) {
        return callback(null, true);
      }

      console.warn(`[CORS] Origen bloqueado: ${origenNormalizado}`);

      return callback(new Error(`Origen no permitido por CORS: ${origenNormalizado}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ── Prefijo global y versionado ──────────────────────────────────────────
  app.setGlobalPrefix(config.get<string>('API_PREFIX', 'api/v1'));

  // ── Pipes globales ────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Filtros e Interceptors globales ───────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ── Swagger (siempre activo en desarrollo/QA) ────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SEDH API')
    .setDescription('Sistema Web Institucional Integrado — Secretaría de Derechos Humanos')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 SEDH Backend corriendo en: http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger disponible en:     http://localhost:${port}/api/docs`);
}

bootstrap();
