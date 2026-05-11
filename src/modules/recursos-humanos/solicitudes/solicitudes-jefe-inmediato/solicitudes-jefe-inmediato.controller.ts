import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../../shared/guards/permisos.guard';
import { RequierePermiso } from '../../../../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../../../../shared/decorators/usuario-actual.decorator';
import { JwtPayload } from '../../../../core/auth/strategies/jwt.strategy';
import { SolicitudesJefeInmediatoService } from './solicitudes-jefe-inmediato.service';

@ApiTags('Solicitudes Jefe Inmediato')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('rrhh/jefe-inmediato')
export class SolicitudesJefeInmediatoController {
  constructor(private readonly solicitudesJefeInmediatoService: SolicitudesJefeInmediatoService) {}

  @Post('pendientes')
  @ApiOperation({ summary: 'Cargar solicitudes pendientes por aprobar del jefe inmediato' })
  @RequierePermiso('rrhh.jefe-inmediato.leer')
  cargarDatosAprobarJefeInmediato(@UsuarioActual() usuario: JwtPayload) {
    return this.solicitudesJefeInmediatoService.cargarDatosAprobarJefeInmediato(usuario.email);
  }
}
