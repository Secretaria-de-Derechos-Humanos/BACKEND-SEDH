import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuditLog } from './entities/audit-log.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        privateKey: config.get<string>('jwt.privateKey'),
        publicKey: config.get<string>('jwt.publicKey'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: config.get<string>('jwt.accessExpiration', '15m'),
        },
      }),
    }),
    TypeOrmModule.forFeature([AuditLog]),
    UsersModule,
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, JwtModule, PassportModule],
})
export class AuthModule {}
