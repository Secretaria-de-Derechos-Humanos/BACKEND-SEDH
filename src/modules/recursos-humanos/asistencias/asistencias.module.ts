import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsistenciasService } from './asistencias.service';
import { AsistenciasController } from './asistencias.controller';
import { Asistencia } from './entities/asistencia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asistencia])],
  providers: [AsistenciasService],
  controllers: [AsistenciasController],
  exports: [AsistenciasService],
})
export class AsistenciasModule {}
