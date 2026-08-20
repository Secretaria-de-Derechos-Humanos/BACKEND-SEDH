import { Module } from '@nestjs/common';
import { SolicitudesAgenteSeguridadController } from './solicitudes-agente-seguridad.controller';
import { SolicitudesAgenteSeguridadService } from './solicitudes-agente-seguridad.service';

@Module({
  controllers: [SolicitudesAgenteSeguridadController],
  providers: [SolicitudesAgenteSeguridadService],
  exports: [SolicitudesAgenteSeguridadService],
})
export class SolicitudesAgenteSeguridadModule {}
