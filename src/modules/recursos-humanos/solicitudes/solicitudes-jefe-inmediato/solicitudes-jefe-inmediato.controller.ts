import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { SolicitudesJefeInmediatoService } from './solicitudes-jefe-inmediato.service';
import { CargarPendientesJefeDto } from './dto/cargar-pendientes-jefe.dto';

@ApiTags('Solicitudes Jefe Inmediato')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rrhh/jefe-inmediato')
export class SolicitudesJefeInmediatoController {
  constructor(private readonly solicitudesJefeInmediatoService: SolicitudesJefeInmediatoService) {}

  @Post('pendientes')
  @ApiOperation({ summary: 'Cargar solicitudes pendientes por aprobar del jefe inmediato' })
  @ApiBody({ type: CargarPendientesJefeDto })
  cargarDatosAprobarJefeInmediato(@Body() body: CargarPendientesJefeDto) {
    return this.solicitudesJefeInmediatoService.cargarDatosAprobarJefeInmediato(
      body.email,
      body.rol,
      body.idmodulo,
    );
  }
}
