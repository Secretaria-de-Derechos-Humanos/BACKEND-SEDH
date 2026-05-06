import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudEmpleado } from './entities/solicitud-empleado.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudEmpleado])],
  providers: [SolicitudesService],
  controllers: [SolicitudesController],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
