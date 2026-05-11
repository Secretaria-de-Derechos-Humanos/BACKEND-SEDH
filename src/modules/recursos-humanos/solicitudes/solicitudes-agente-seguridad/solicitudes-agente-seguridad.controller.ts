import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { SolicitudesAgenteSeguriadService } from './solicitudes-agente-seguridad.service';
import { CargarSolicitudesAgenteDto } from './dto/cargar-solicitudes-agente.dto';
import { RegistrarHoraSalidaDto } from './dto/registrar-hora-salida.dto';
import { RegistrarHoraRetornoDto } from './dto/registrar-hora-retorno.dto';

@ApiTags('Solicitudes Agente de Seguridad')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rrhh/agente-seguridad')
export class SolicitudesAgenteSeguriadController {
  constructor(
    private readonly solicitudesAgenteSeguriadService: SolicitudesAgenteSeguriadService,
  ) {}

  @Post('solicitudes')
  @ApiOperation({ summary: 'Cargar solicitudes aprobadas para registro de hora salida/retorno' })
  @ApiBody({ type: CargarSolicitudesAgenteDto })
  cargarSolicitudes(@Body() body: CargarSolicitudesAgenteDto) {
    return this.solicitudesAgenteSeguriadService.cargarSolicitudes(body);
  }

  @Post('hora-salida')
  @ApiOperation({ summary: 'Registrar hora de salida del empleado' })
  @ApiBody({ type: RegistrarHoraSalidaDto })
  registrarHoraSalida(@Body() body: RegistrarHoraSalidaDto) {
    return this.solicitudesAgenteSeguriadService.registrarHoraSalida(body);
  }

  @Post('hora-retorno')
  @ApiOperation({ summary: 'Registrar hora de retorno del empleado' })
  @ApiBody({ type: RegistrarHoraRetornoDto })
  registrarHoraRetorno(@Body() body: RegistrarHoraRetornoDto) {
    return this.solicitudesAgenteSeguriadService.registrarHoraRetorno(body);
  }
}
