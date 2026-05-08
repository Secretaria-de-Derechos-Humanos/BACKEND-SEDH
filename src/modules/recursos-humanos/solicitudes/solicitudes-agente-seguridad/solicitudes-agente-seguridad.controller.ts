import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../../shared/guards/permisos.guard';
import { SolicitudesAgenteSeguriadService } from './solicitudes-agente-seguridad.service';

@ApiTags('Solicitudes Agente de Seguridad')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('recursos-humanos/solicitudes-agente-seguridad')
export class SolicitudesAgenteSeguriadController {
  constructor(
    private readonly solicitudesAgenteSeguriadService: SolicitudesAgenteSeguriadService,
  ) {}
}
