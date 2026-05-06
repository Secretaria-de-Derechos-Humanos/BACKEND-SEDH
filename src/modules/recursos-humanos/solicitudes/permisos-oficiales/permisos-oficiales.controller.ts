import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PermisosOficialesService } from './permisos-oficiales.service';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../../shared/guards/permisos.guard';
import { RequierePermiso } from '../../../../shared/decorators/requiere-permiso.decorator';

@ApiTags('Permisos Oficiales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('recursos-humanos/permisos-oficiales')
export class PermisosOficialesController {
  constructor(private readonly service: PermisosOficialesService) {}

  @Get()
  @RequierePermiso('rrhh.permisos-oficiales.leer')
  findAll() { return this.service.findAll(); }

  @Get('empleado/:email')
  @RequierePermiso('rrhh.permisos-oficiales.leer')
  findByEmpleado(@Param('email') email: string) { return this.service.findByEmpleado(email); }

  @Get(':id')
  @RequierePermiso('rrhh.permisos-oficiales.leer')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }
}
