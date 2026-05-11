import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { SolicitudesSubgerenteRrhhService } from './solicitudes-subgerente-rrhh.service';
import { CargarPendientesSubgerenteDto } from './dto/cargar-pendientes-subgerente.dto';
import { ResponderSolicitudSubgerenteDto } from './dto/responder-solicitud-subgerente.dto';

@ApiTags('Solicitudes Subgerente RRHH')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rrhh/subgerente')
export class SolicitudesSubgerenteRrhhController {
  constructor(
    private readonly solicitudesSubgerenteRrhhService: SolicitudesSubgerenteRrhhService,
  ) {}

  @Post('pendientes')
  @ApiOperation({ summary: 'Cargar solicitudes pendientes por aprobar de la subgerente RRHH' })
  @ApiBody({ type: CargarPendientesSubgerenteDto })
  cargarPendientes(@Body() body: CargarPendientesSubgerenteDto) {
    return this.solicitudesSubgerenteRrhhService.cargarPendientes(body);
  }

  @Post('responder')
  @ApiOperation({ summary: 'Aprobar o rechazar una solicitud como subgerente RRHH' })
  @ApiBody({ type: ResponderSolicitudSubgerenteDto })
  responderSolicitud(@Body() body: ResponderSolicitudSubgerenteDto) {
    return this.solicitudesSubgerenteRrhhService.responderSolicitud(body);
  }
}
