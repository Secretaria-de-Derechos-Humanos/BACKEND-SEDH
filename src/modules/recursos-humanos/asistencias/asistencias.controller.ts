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
import { AsistenciasService } from './asistencias.service';
import { CrearAsistenciaDto } from './dto/crear-asistencia.dto';
import { ActualizarAsistenciaDto } from './dto/actualizar-asistencia.dto';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { RequirePermissions } from '../../../../shared/decorators/require-permissions.decorator';

@ApiTags('RR.HH — Asistencias')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('recursos-humanos/asistencias')
export class AsistenciasController {
  constructor(private readonly asistenciasService: AsistenciasService) {}

  @Post()
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'asistencias', action: 'create' })
  @ApiOperation({ summary: 'Registrar asistencia' })
  crear(@Body() dto: CrearAsistenciaDto) {
    return this.asistenciasService.crear(dto);
  }

  @Get()
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'asistencias', action: 'read' })
  @ApiOperation({ summary: 'Listar asistencias' })
  @ApiQuery({ name: 'empleadoId', required: false })
  listar(@Query('empleadoId') empleadoId?: string) {
    if (empleadoId) return this.asistenciasService.listarPorEmpleado(empleadoId);
    return this.asistenciasService.listarTodas();
  }

  @Get(':id')
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'asistencias', action: 'read' })
  @ApiOperation({ summary: 'Obtener registro de asistencia' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.asistenciasService.obtenerUna(id);
  }

  @Patch(':id')
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'asistencias', action: 'update' })
  @ApiOperation({ summary: 'Actualizar registro de asistencia' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarAsistenciaDto) {
    return this.asistenciasService.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'asistencias', action: 'delete' })
  @ApiOperation({ summary: 'Eliminar registro de asistencia' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.asistenciasService.eliminar(id);
  }
}
