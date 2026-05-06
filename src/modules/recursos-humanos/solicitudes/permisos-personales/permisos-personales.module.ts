import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermisoPersonal } from './entities/permiso-personal.entity';
import { PermisosPersonalesService } from './permisos-personales.service';
import { PermisosPersonalesController } from './permisos-personales.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PermisoPersonal])],
  controllers: [PermisosPersonalesController],
  providers: [PermisosPersonalesService],
  exports: [TypeOrmModule, PermisosPersonalesService],
})
export class PermisosPersonalesModule {}
