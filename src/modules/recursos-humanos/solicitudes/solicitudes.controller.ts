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
import { SolicitudesService } from './solicitudes.service';
import { CrearSolicitudEmpleadoDto } from './dto/crear-solicitud-empleado.dto';
import { ActualizarSolicitudEmpleadoDto } from './dto/actualizar-solicitud-empleado.dto';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { RequirePermissions } from '../../../../shared/decorators/require-permissions.decorator';

@ApiTags('RR.HH — Solicitudes de Empleados')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('recursos-humanos/solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'solicitudes', action: 'create' })
  @ApiOperation({ summary: 'Crear solicitud de empleado' })
  crear(@Body() dto: CrearSolicitudEmpleadoDto) {
    return this.solicitudesService.crear(dto);
  }

  @Get()
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'solicitudes', action: 'read' })
  @ApiOperation({ summary: 'Listar solicitudes' })
  @ApiQuery({ name: 'empleadoId', required: false })
  listar(@Query('empleadoId') empleadoId?: string) {
    if (empleadoId) return this.solicitudesService.listarPorEmpleado(empleadoId);
    return this.solicitudesService.listarTodas();
  }

  @Get(':id')
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'solicitudes', action: 'read' })
  @ApiOperation({ summary: 'Obtener solicitud' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.solicitudesService.obtenerUna(id);
  }

  @Patch(':id')
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'solicitudes', action: 'update' })
  @ApiOperation({ summary: 'Actualizar estado de solicitud' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarSolicitudEmpleadoDto) {
    return this.solicitudesService.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ module: 'recursos-humanos', subModule: 'solicitudes', action: 'delete' })
  @ApiOperation({ summary: 'Eliminar solicitud' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.solicitudesService.eliminar(id);
  }
}
