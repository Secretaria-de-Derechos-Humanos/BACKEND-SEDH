import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../../shared/guards/permisos.guard';
import { SolicitudesSubgerenteRrhhService } from './solicitudes-subgerente-rrhh.service';

@ApiTags('Solicitudes Subgerente RRHH')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('recursos-humanos/solicitudes-subgerente-rrhh')
export class SolicitudesSubgerenteRrhhController {
  constructor(
    private readonly solicitudesSubgerenteRrhhService: SolicitudesSubgerenteRrhhService,
  ) {}
}
