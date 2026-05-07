import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsuarioActual } from '../../shared/decorators/usuario-actual.decorator';
import { JwtPayload } from './strategies/jwt.strategy';

const COOKIE_NAME = 'refreshToken';
const COOKIE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutos en ms

@ApiTags('Autenticacion')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setCookieRefresh(res: Response, token: string): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/api/v1/auth',
    });
  }

  private clearCookieRefresh(res: Response): void {
    res.clearCookie(COOKIE_NAME, { path: '/api/v1/auth' });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60, limit: 5 } })
  @ApiOperation({ summary: 'Iniciar sesion' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(dto);
    this.setCookieRefresh(res, refreshToken);
    return { accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60, limit: 10 } })
  @ApiOperation({ summary: 'Renovar access token (refresh token en cookie HttpOnly)' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token: string | undefined = req.cookies?.[COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException('Refresh token no encontrado');
    }
    const { accessToken, refreshToken } = await this.authService.refresh(token);
    this.setCookieRefresh(res, refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar sesion (revocar refresh token y borrar cookie)' })
  async logout(
    @UsuarioActual() usuario: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token: string | undefined = req.cookies?.[COOKIE_NAME];
    if (token) {
      await this.authService.logoutByToken(token);
    } else {
      // Fallback: revocar por jti del access token si no hay cookie
      await this.authService.logout(usuario.jti);
    }
    this.clearCookieRefresh(res);
  }
}
