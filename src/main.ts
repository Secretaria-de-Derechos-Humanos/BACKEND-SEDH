import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as session from 'express-session';
import * as connectPgSimple from 'connect-pg-simple';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // ── Seguridad ────────────────────────────────────────────────────────────
  app.use(helmet());


  // ── CORS ─────────────────────────────────────────────────────────────────
  const allowedOrigins = config.get<string>('CORS_ORIGINS', '').split(',');
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ── Sesiones (store en PostgreSQL) ────────────────────────────────────────
  const PgStore = connectPgSimple(session);
  app.use(
    session({
      store: new PgStore({
        conString: `postgresql://${config.get('DB_USERNAME')}:${config.get('DB_PASSWORD')}@${config.get('DB_HOST')}:${config.get('DB_PORT')}/${config.get('DB_NAME')}`,
        tableName: 'user_sessions',
        createTableIfMissing: true,
      }),
      secret: config.get<string>('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: config.get<number>('SESSION_MAX_AGE', 86400000),
        sameSite: 'strict',
      },
    }),
  );

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
