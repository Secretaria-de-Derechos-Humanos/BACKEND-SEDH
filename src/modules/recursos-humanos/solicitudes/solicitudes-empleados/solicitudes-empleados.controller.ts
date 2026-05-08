import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../../shared/guards/permisos.guard';
import { RequierePermiso } from '../../../../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../../../../shared/decorators/usuario-actual.decorator';
import { Usuario } from '../../../../core/usuarios/entities/usuario.entity';
import { SolicitudesEmpleadosService } from './solicitudes-empleados.service';

@ApiTags('Solicitudes Empleados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('recursos-humanos/solicitudes-empleados')
export class SolicitudesEmpleadosController {
  constructor(private readonly solicitudesEmpleadosService: SolicitudesEmpleadosService) {}

  @Get('mis-solicitudes')
  @RequierePermiso('rrhh.solicitudes-empleados.leer')
  getSolicitudesEmpleadoRRHH(@UsuarioActual() usuario: Usuario) {
    return this.solicitudesEmpleadosService.getSolicitudesEmpleadoRRHH(usuario.emailInstitucional);
  }

  @Get('mis-solicitudes-emergencia')
  @RequierePermiso('rrhh.solicitudes-empleados.leer')
  getMisSolicitudesEmergencia(@UsuarioActual() usuario: Usuario) {
    return this.solicitudesEmpleadosService.getMisSolicitudesEmergencia(usuario.emailInstitucional);
  }
}
