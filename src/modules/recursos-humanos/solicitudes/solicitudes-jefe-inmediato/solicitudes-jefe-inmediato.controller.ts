import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../../shared/guards/permisos.guard';
import { SolicitudesJefeInmediatoService } from './solicitudes-jefe-inmediato.service';

@ApiTags('Solicitudes Jefe Inmediato')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('recursos-humanos/solicitudes-jefe-inmediato')
export class SolicitudesJefeInmediatoController {
  constructor(private readonly solicitudesJefeInmediatoService: SolicitudesJefeInmediatoService) {}
}
