import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesPermisosService } from './reportes-permisos.service';
import { ReportesPermisosController } from './reportes-permisos.controller';
import { ReportePermiso } from './entities/reporte-permiso.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReportePermiso])],
  providers: [ReportesPermisosService],
  controllers: [ReportesPermisosController],
  exports: [ReportesPermisosService],
})
export class ReportesPermisosModule {}
