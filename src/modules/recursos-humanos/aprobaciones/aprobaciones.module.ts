import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AprobacionesController } from './aprobaciones.controller';
import { AprobacionesService } from './aprobaciones.service';
import { PermisoPersonal } from '../solicitudes/permisos-personales/entities/permiso-personal.entity';
import { PermisoOficial } from '../solicitudes/permisos-oficiales/entities/permiso-oficial.entity';
import { Vacaciones } from '../solicitudes/vacaciones/entities/vacaciones.entity';
import { EstadoSolicitud } from '../catalogos/entities/estado-solicitud.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermisoPersonal, PermisoOficial, Vacaciones, EstadoSolicitud]),
  ],
  controllers: [AprobacionesController],
  providers: [AprobacionesService],
  exports: [AprobacionesService],
})
export class AprobacionesModule {}
