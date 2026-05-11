import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { ReportesPermisosService } from './reportes-permisos.service';
import { ReportePermisosMesDto } from './dto/reporte-permisos-mes.dto';

@ApiTags('Reportes de Permisos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rrhh/reportes-permisos')
export class ReportesPermisosController {
  constructor(private readonly reportesPermisosService: ReportesPermisosService) {}

  @Post('por-mes')
  @ApiOperation({ summary: 'Obtener reporte de permisos de empleados por mes' })
  @ApiBody({ type: ReportePermisosMesDto })
  reportePermisosMes(@Body() body: ReportePermisosMesDto) {
    return this.reportesPermisosService.reportePermisosMes(body);
  }
}
