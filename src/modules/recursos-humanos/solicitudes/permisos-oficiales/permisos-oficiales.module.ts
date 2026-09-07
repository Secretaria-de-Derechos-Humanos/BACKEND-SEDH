import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermisoOficial } from './entities/permiso-oficial.entity';
import { PermisosOficialesController } from './permisos-oficiales.controller';
import { PermisosOficialesService } from './permisos-oficiales.service';
import { NotificacionesModule } from './../../notificaciones/notificaciones.module';

@Module({
  imports: [TypeOrmModule.forFeature([PermisoOficial]), NotificacionesModule],
  controllers: [PermisosOficialesController],
  providers: [PermisosOficialesService],
  exports: [PermisosOficialesService],
})
export class PermisosOficialesModule {}
