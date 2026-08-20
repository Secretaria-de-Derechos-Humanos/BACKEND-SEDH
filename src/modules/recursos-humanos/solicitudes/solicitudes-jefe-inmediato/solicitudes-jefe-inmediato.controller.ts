import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../../../core/auth/strategies/jwt.strategy';
import { SolicitudesJefeInmediatoService } from './solicitudes-jefe-inmediato.service';
import { CargarPendientesJefeDto } from './dto/cargar-pendientes-jefe.dto';
import { ResponderSolicitudJefeDto } from './dto/responder-solicitud-jefe.dto';

type RequestAutenticado = Request & {
  user?: JwtPayload;
};

@ApiTags('Solicitudes Jefe Inmediato')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rrhh/jefe-inmediato')
export class SolicitudesJefeInmediatoController {
  constructor(private readonly solicitudesJefeInmediatoService: SolicitudesJefeInmediatoService) {}

  @Post('pendientes')
  @ApiOperation({
    summary: 'Cargar solicitudes pendientes por aprobar del jefe inmediato',
  })
  cargarDatosAprobarJefeInmediato(
    @Req() request: RequestAutenticado,
    @Body() body: CargarPendientesJefeDto,
  ) {
    const user = this.obtenerUsuario(request);

    return this.solicitudesJefeInmediatoService.cargarDatosAprobarJefeInmediato(
      user.email,
      user.rol,
      body.modulo,
    );
  }

  @Post('responder')
  @ApiOperation({
    summary: 'Aprobar o rechazar una solicitud como jefe inmediato',
  })
  responderSolicitud(@Req() request: RequestAutenticado, @Body() body: ResponderSolicitudJefeDto) {
    const user = this.obtenerUsuario(request);
    return this.solicitudesJefeInmediatoService.responderSolicitud(body, user.email, user.rol);
  }

  private obtenerUsuario(request: RequestAutenticado): {
    email: string;
    rol: number;
  } {
    const user = request.user;
    const email = user?.email?.trim();

    if (!user || !email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }
    const rolPermitido = user.roles?.find((item) => [2, 5].includes(Number(item.r)));
    if (!rolPermitido) {
      throw new UnauthorizedException('El usuario no posee un rol autorizado para este recurso');
    }

    return {
      email,
      rol: Number(rolPermitido.r),
    };
  }
}
