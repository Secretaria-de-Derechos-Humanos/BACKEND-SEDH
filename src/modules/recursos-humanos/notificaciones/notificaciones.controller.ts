import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Notificaciones')
@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  // ============================================================
  // TODAS LAS NOTIFICACIONES
  // ============================================================

  @Get()
  async listar(@Req() request: any) {
    const idUsuario = request.user?.sub;
    if (!idUsuario) {
      throw new UnauthorizedException('No se pudo identificar al usuario.');
    }
    return this.notificacionesService.listarPorUsuario(idUsuario);
  }

  // ============================================================
  // NO LEÍDAS
  // ============================================================

  @Get('no-leidas')
  async noLeidas(@Req() request: any) {
    const idUsuario = request.user?.sub;
    if (!idUsuario) {
      throw new UnauthorizedException('No se pudo identificar al usuario.');
    }
    return this.notificacionesService.listarNoLeidas(idUsuario);
  }
  // ============================================================
  // CONTADOR
  // ============================================================
  @Get('contador')
  async contador(@Req() request: any) {
    const idUsuario = request.user?.sub;
    if (!idUsuario) {
      throw new UnauthorizedException('No se pudo identificar al usuario.');
    }
    const cantidad = await this.notificacionesService.contarNoLeidas(idUsuario);

    return {
      cantidad,
    };
  }

  // ============================================================
  // MARCAR UNA COMO LEÍDA
  // ============================================================

  @Patch(':id/leida')
  async marcarComoLeida(@Param('id') idNotificacion: string, @Req() request: any) {
    const idUsuario = request.user?.sub;

    if (!idUsuario) {
      throw new UnauthorizedException('No se pudo identificar al usuario.');
    }

    return this.notificacionesService.marcarComoLeida(idNotificacion, idUsuario);
  }

  // ============================================================
  // MARCAR TODAS COMO LEÍDAS
  // ============================================================

  @Patch('marcar-todas-leidas')
  async marcarTodasComoLeidas(@Req() request: any) {
    const idUsuario = request.user?.sub;

    if (!idUsuario) {
      throw new UnauthorizedException('No se pudo identificar al usuario.');
    }

    await this.notificacionesService.marcarTodasComoLeidas(idUsuario);

    return {
      success: true,
      message: 'Notificaciones marcadas como leídas.',
    };
  }
}
