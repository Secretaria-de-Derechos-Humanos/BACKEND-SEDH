import { Module } from '@nestjs/common';
import { AsistenciasModule } from './asistencias/asistencias.module';
import { ReportesPermisosModule } from './reportes-permisos/reportes-permisos.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';

@Module({
  imports: [AsistenciasModule, ReportesPermisosModule, SolicitudesModule],
})
export class RecursosHumanosModule {}
