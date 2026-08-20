import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { AgenteSeguridadGuard } from '../../../../core/auth/guards/agente-seguridad.guard';
import { JwtPayload } from '../../../../core/auth/strategies/jwt.strategy';
import { SolicitudesAgenteSeguridadService } from './solicitudes-agente-seguridad.service';
import { CargarSolicitudesAgenteDto } from './dto/cargar-solicitudes-agente.dto';
import { RegistrarHoraSalidaDto } from './dto/registrar-hora-salida.dto';
import { RegistrarHoraRetornoDto } from './dto/registrar-hora-retorno.dto';

type RequestAutenticada = Request & {
  user: JwtPayload;
};

@ApiTags('Solicitudes Agente de Seguridad')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, AgenteSeguridadGuard)
@Controller('rrhh/agente-seguridad')
export class SolicitudesAgenteSeguridadController {
  constructor(
    private readonly solicitudesAgenteSeguridadService: SolicitudesAgenteSeguridadService,
  ) {}

  @Post('solicitudes')
  @ApiOperation({
    summary: 'Cargar permisos personales aprobados para el agente de seguridad',
  })
  cargarSolicitudes(@Req() request: RequestAutenticada, @Body() body: CargarSolicitudesAgenteDto) {
    return this.solicitudesAgenteSeguridadService.cargarSolicitudes(body, request.user);
  }

  @Post('hora-salida')
  @ApiOperation({
    summary: 'Registrar la hora real de salida de un permiso personal',
  })
  registrarHoraSalida(@Req() request: RequestAutenticada, @Body() body: RegistrarHoraSalidaDto) {
    return this.solicitudesAgenteSeguridadService.registrarHoraSalida(body, request.user);
  }

  @Post('hora-retorno')
  @ApiOperation({
    summary: 'Registrar la hora real de retorno y ajustar el saldo del permiso personal',
  })
  registrarHoraRetorno(@Req() request: RequestAutenticada, @Body() body: RegistrarHoraRetornoDto) {
    return this.solicitudesAgenteSeguridadService.registrarHoraRetorno(body, request.user);
  }
}
