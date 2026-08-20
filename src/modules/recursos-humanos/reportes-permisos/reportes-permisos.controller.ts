import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../../core/auth/strategies/jwt.strategy';
import { ReportePermisosMesDto } from './dto/reporte-permisos-mes.dto';
import { ReportesPermisosService } from './reportes-permisos.service';

type RequestAutenticado = Request & {
  user?: JwtPayload;
};

@ApiTags('Reportes de Permisos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rrhh/reportes-permisos')
export class ReportesPermisosController {
  constructor(private readonly reportesPermisosService: ReportesPermisosService) {}

  @Post('por-mes')
  @ApiOperation({
    summary: 'Obtener reporte de permisos de empleados por mes',
  })
  reportePermisosMes(@Req() request: RequestAutenticado, @Body() body: ReportePermisosMesDto) {
    const usuario = request.user;
    const email = usuario?.email?.trim();

    if (!usuario || !email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    const rolPermitido = usuario.roles?.find((rol) => [3, 5].includes(Number(rol.r)));

    if (!rolPermitido) {
      throw new ForbiddenException('El usuario no tiene permisos para consultar reportes');
    }

    return this.reportesPermisosService.reportePermisosMes(body, email, Number(rolPermitido.r));
  }
}
