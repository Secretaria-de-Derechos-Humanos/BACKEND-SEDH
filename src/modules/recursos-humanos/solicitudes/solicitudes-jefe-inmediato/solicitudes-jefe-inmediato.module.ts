import { Module } from '@nestjs/common';
import { SolicitudesJefeInmediatoController } from './solicitudes-jefe-inmediato.controller';
import { SolicitudesJefeInmediatoService } from './solicitudes-jefe-inmediato.service';

@Module({
  controllers: [SolicitudesJefeInmediatoController],
  providers: [SolicitudesJefeInmediatoService],
  exports: [SolicitudesJefeInmediatoService],
})
export class SolicitudesJefeInmediatoModule {}
