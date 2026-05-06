import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PermisosPersonalesService } from './permisos-personales.service';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../../shared/guards/permisos.guard';
import { RequierePermiso } from '../../../../shared/decorators/requiere-permiso.decorator';

@ApiTags('Permisos Personales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('recursos-humanos/permisos-personales')
export class PermisosPersonalesController {
  constructor(private readonly service: PermisosPersonalesService) {}

  @Get()
  @RequierePermiso('rrhh.permisos-personales.leer')
  findAll() { return this.service.findAll(); }

  @Get('empleado/:email')
  @RequierePermiso('rrhh.permisos-personales.leer')
  findByEmpleado(@Param('email') email: string) { return this.service.findByEmpleado(email); }

  @Get(':id')
  @RequierePermiso('rrhh.permisos-personales.leer')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }
}
