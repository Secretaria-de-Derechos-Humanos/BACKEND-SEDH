import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportesPermisosService } from './reportes-permisos.service';
import { CrearReportePermisoDto } from './dto/crear-reporte-permiso.dto';
import { RevisarReportePermisoDto } from './dto/revisar-reporte-permiso.dto';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { RequirePermissions } from '../../../../shared/decorators/require-permissions.decorator';

@ApiTags('RR.HH — Reportes de Permisos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('recursos-humanos/reportes-permisos')
export class ReportesPermisosController {
  constructor(private readonly reportesPermisosService: ReportesPermisosService) {}

  @Post()
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'reportes-permisos', action: 'create' })
  @ApiOperation({ summary: 'Crear reporte de permiso' })
  crear(@Body() dto: CrearReportePermisoDto) {
    return this.reportesPermisosService.crear(dto);
  }

  @Get()
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'reportes-permisos', action: 'read' })
  @ApiOperation({ summary: 'Listar reportes de permisos' })
  @ApiQuery({ name: 'empleadoId', required: false })
  listar(@Query('empleadoId') empleadoId?: string) {
    if (empleadoId) return this.reportesPermisosService.listarPorEmpleado(empleadoId);
    return this.reportesPermisosService.listarTodos();
  }

  @Get(':id')
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'reportes-permisos', action: 'read' })
  @ApiOperation({ summary: 'Obtener reporte de permiso' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportesPermisosService.obtenerUno(id);
  }

  @Patch(':id/revisar')
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'reportes-permisos', action: 'update' })
  @ApiOperation({ summary: 'Aprobar o rechazar reporte de permiso' })
  revisar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RevisarReportePermisoDto) {
    return this.reportesPermisosService.revisar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'reportes-permisos', action: 'delete' })
  @ApiOperation({ summary: 'Eliminar reporte de permiso' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportesPermisosService.eliminar(id);
  }
}
