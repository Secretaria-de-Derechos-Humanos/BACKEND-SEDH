import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentEmployee } from '../../shared/decorators/current-employee.decorator';
import { Employee } from '../users/entities/employee.entity';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60, limit: 5 } })
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso o requiere 2FA' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(
      dto,
      req.ip ?? 'unknown',
      req.headers['user-agent'] ?? 'unknown',
    );
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60, limit: 5 } })
  @ApiOperation({ summary: 'Verificar código TOTP 2FA' })
  verify2fa(@Body() dto: Verify2faDto, @Req() req: Request) {
    return this.authService.verify2fa(
      dto,
      req.ip ?? 'unknown',
      req.headers['user-agent'] ?? 'unknown',
    );
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar secreto TOTP para configurar 2FA' })
  setup2fa(@CurrentEmployee() employee: Employee) {
    return this.authService.generate2faSecret(employee.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Habilitar 2FA con código de verificación' })
  enable2fa(@CurrentEmployee() employee: Employee, @Body('token') token: string) {
    return this.authService.enableTwoFactor(employee.id, token);
  }
}
