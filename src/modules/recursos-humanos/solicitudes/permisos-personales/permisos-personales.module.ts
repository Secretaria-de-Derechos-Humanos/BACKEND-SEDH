import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermisoPersonal } from './entities/permiso-personal.entity';
import { PermisosPersonalesController } from './permisos-personales.controller';
import { PermisosPersonalesService } from './permisos-personales.service';

@Module({
  imports: [TypeOrmModule.forFeature([PermisoPersonal])],
  controllers: [PermisosPersonalesController],
  providers: [PermisosPersonalesService],
  exports: [PermisosPersonalesService],
})
export class PermisosPersonalesModule {}
