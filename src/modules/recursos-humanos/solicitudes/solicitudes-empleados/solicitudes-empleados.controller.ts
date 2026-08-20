import { Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../../../core/auth/strategies/jwt.strategy';
import { SolicitudesEmpleadosService } from './solicitudes-empleados.service';

@ApiTags('Solicitudes Empleados')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rrhh/solicitudes-empleados')
export class SolicitudesEmpleadosController {
  constructor(private readonly solicitudesEmpleadosService: SolicitudesEmpleadosService) {}

  private obtenerEmail(request: Request & { user: JwtPayload }): string {
    const email = request.user?.email?.trim();

    if (!email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return email;
  }

  @Post('mis-solicitudes')
  @ApiOperation({
    summary: 'Consultar mis solicitudes',
  })
  getSolicitudesEmpleadoRRHH(@Req() request: Request & { user: JwtPayload }) {
    return this.solicitudesEmpleadosService.getSolicitudesEmpleadoRRHH(this.obtenerEmail(request));
  }

  @Post('mis-solicitudes-emergencia')
  @ApiOperation({
    summary: 'Consultar mis solicitudes de emergencia',
  })
  getMisSolicitudesEmergencia(@Req() request: Request & { user: JwtPayload }) {
    return this.solicitudesEmpleadosService.getMisSolicitudesEmergencia(this.obtenerEmail(request));
  }

  @Post('datos-permiso')
  @ApiOperation({
    summary: 'Cargar datos para agregar permisos',
  })
  cargarDatosAgregarPermisos(@Req() request: Request & { user: JwtPayload }) {
    return this.solicitudesEmpleadosService.cargarDatosAgregarPermisos(this.obtenerEmail(request));
  }
}
