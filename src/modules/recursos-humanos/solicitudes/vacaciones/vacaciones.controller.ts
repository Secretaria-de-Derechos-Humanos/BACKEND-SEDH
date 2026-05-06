import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VacacionesService } from './vacaciones.service';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../../shared/guards/permisos.guard';
import { RequierePermiso } from '../../../../shared/decorators/requiere-permiso.decorator';

@ApiTags('Vacaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('recursos-humanos/vacaciones')
export class VacacionesController {
  constructor(private readonly service: VacacionesService) {}

  @Get()
  @RequierePermiso('rrhh.vacaciones.leer')
  findAll() { return this.service.findAll(); }

  @Get('empleado/:email')
  @RequierePermiso('rrhh.vacaciones.leer')
  findByEmpleado(@Param('email') email: string) { return this.service.findByEmpleado(email); }

  @Get(':id')
  @RequierePermiso('rrhh.vacaciones.leer')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }
}
