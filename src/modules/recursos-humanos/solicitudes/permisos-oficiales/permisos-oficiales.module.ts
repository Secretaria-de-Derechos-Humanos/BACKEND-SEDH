import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermisoOficial } from './entities/permiso-oficial.entity';
import { PermisosOficialesService } from './permisos-oficiales.service';
import { PermisosOficialesController } from './permisos-oficiales.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PermisoOficial])],
  controllers: [PermisosOficialesController],
  providers: [PermisosOficialesService],
  exports: [PermisosOficialesService],
})
export class PermisosOficialesModule {}
