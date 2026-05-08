import { Module } from '@nestjs/common';
import { SolicitudesEmpleadosController } from './solicitudes-empleados.controller';
import { SolicitudesEmpleadosService } from './solicitudes-empleados.service';

@Module({
  controllers: [SolicitudesEmpleadosController],
  providers: [SolicitudesEmpleadosService],
  exports: [SolicitudesEmpleadosService],
})
export class SolicitudesEmpleadosModule {}
