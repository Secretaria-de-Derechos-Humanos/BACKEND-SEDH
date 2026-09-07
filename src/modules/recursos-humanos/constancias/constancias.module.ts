import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Constancia } from './entities/constancia.entity';
import { ConstanciaFinalidad } from './entities/constancia-finalidad.entity';
import { EstadoSolicitud } from '../catalogos/entities/estado-solicitud.entity';
import { ConstanciasController } from './constancias.controller';
import { ConstanciasService } from './constancias.service';

import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Constancia, ConstanciaFinalidad, EstadoSolicitud]),
    NotificacionesModule,
  ],
  controllers: [ConstanciasController],
  providers: [ConstanciasService],
  exports: [ConstanciasService],
})
export class ConstanciasModule {}
