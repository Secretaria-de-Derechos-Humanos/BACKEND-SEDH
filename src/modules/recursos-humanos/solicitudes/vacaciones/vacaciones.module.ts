import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vacaciones } from './entities/vacaciones.entity';
import { VacacionesSaldo } from './entities/vacaciones-saldo.entity';
import { Feriado } from './entities/feriado.entity';
import { HistorialVacaciones } from './entities/historial-vacaciones.entity';
import { VacacionesController } from './vacaciones.controller';
import { VacacionesService } from './vacaciones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vacaciones, VacacionesSaldo, Feriado, HistorialVacaciones])],
  controllers: [VacacionesController],
  providers: [VacacionesService],
  exports: [VacacionesService],
})
export class VacacionesModule {}
