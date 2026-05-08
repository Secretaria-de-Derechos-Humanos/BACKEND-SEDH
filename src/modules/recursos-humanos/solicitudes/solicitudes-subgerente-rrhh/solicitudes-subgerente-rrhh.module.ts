import { Module } from '@nestjs/common';
import { SolicitudesSubgerenteRrhhController } from './solicitudes-subgerente-rrhh.controller';
import { SolicitudesSubgerenteRrhhService } from './solicitudes-subgerente-rrhh.service';

@Module({
  controllers: [SolicitudesSubgerenteRrhhController],
  providers: [SolicitudesSubgerenteRrhhService],
  exports: [SolicitudesSubgerenteRrhhService],
})
export class SolicitudesSubgerenteRrhhModule {}
