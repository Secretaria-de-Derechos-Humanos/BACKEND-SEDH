import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpleadosService } from './empleados.service';
import { EmpleadosController } from './empleados.controller';
import { Empleado } from './entities/empleado.entity';
import { HistorialCargo } from './entities/historial-cargo.entity';
import { HorasDisponible } from './entities/horas-disponible.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Empleado, HistorialCargo, HorasDisponible])],
  controllers: [EmpleadosController],
  providers: [EmpleadosService],
  exports: [TypeOrmModule, EmpleadosService],
})
export class EmpleadosModule {}
