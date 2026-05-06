import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vacacion } from './entities/vacacion.entity';
import { VacacionesService } from './vacaciones.service';
import { VacacionesController } from './vacaciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Vacacion])],
  controllers: [VacacionesController],
  providers: [VacacionesService],
  exports: [TypeOrmModule, VacacionesService],
})
export class VacacionesModule {}
