import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EmpleadosService } from './empleados.service';
import { CrearEmpleadoDto } from './dto/crear-empleado.dto';
import { ActualizarEmpleadoDto } from './dto/actualizar-empleado.dto';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../shared/guards/permisos.guard';
import { RequierePermiso } from '../../../shared/decorators/requiere-permiso.decorator';

@ApiTags('Empleados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('recursos-humanos/empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Get()
  @RequierePermiso('rrhh.empleados.leer')
  findAll() { return this.empleadosService.findAll(); }

  @Get(':email')
  @RequierePermiso('rrhh.empleados.leer')
  findOne(@Param('email') email: string) { return this.empleadosService.findOne(email); }

  @Post()
  @RequierePermiso('rrhh.empleados.crear')
  crear(@Body() dto: CrearEmpleadoDto) { return this.empleadosService.crear(dto); }

  @Patch(':email')
  @RequierePermiso('rrhh.empleados.actualizar')
  actualizar(@Param('email') email: string, @Body() dto: ActualizarEmpleadoDto) {
    return this.empleadosService.actualizar(email, dto);
  }

  @Get(':email/historial-cargos')
  @RequierePermiso('rrhh.empleados.leer')
  findHistorial(@Param('email') email: string) { return this.empleadosService.findHistorial(email); }

  @Get(':email/horas-disponibles')
  @RequierePermiso('rrhh.empleados.leer')
  findHorasDisponibles(@Param('email') email: string) { return this.empleadosService.findHorasDisponibles(email); }
}
