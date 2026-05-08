import { Module } from '@nestjs/common';
import { SolicitudesAgenteSeguriadController } from './solicitudes-agente-seguridad.controller';
import { SolicitudesAgenteSeguriadService } from './solicitudes-agente-seguridad.service';

@Module({
  controllers: [SolicitudesAgenteSeguriadController],
  providers: [SolicitudesAgenteSeguriadService],
  exports: [SolicitudesAgenteSeguriadService],
})
export class SolicitudesAgenteSeguriadModule {}
