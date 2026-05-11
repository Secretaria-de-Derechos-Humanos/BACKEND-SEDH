import { Module } from '@nestjs/common';
import { CatalogosModule } from './catalogos/catalogos.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { PermisosOficialesModule } from './solicitudes/permisos-oficiales/permisos-oficiales.module';
import { PermisosPersonalesModule } from './solicitudes/permisos-personales/permisos-personales.module';
import { VacacionesModule } from './solicitudes/vacaciones/vacaciones.module';
import { SolicitudesEmpleadosModule } from './solicitudes/solicitudes-empleados/solicitudes-empleados.module';
import { SolicitudesJefeInmediatoModule } from './solicitudes/solicitudes-jefe-inmediato/solicitudes-jefe-inmediato.module';
import { SolicitudesSubgerenteRrhhModule } from './solicitudes/solicitudes-subgerente-rrhh/solicitudes-subgerente-rrhh.module';
import { SolicitudesAgenteSeguriadModule } from './solicitudes/solicitudes-agente-seguridad/solicitudes-agente-seguridad.module';
import { ReportesPermisosModule } from './reportes-permisos/reportes-permisos.module';

@Module({
  imports: [
    CatalogosModule,
    EmpleadosModule,
    PermisosOficialesModule,
    PermisosPersonalesModule,
    VacacionesModule,
    SolicitudesEmpleadosModule,
    SolicitudesJefeInmediatoModule,
    SolicitudesSubgerenteRrhhModule,
    SolicitudesAgenteSeguriadModule,
    ReportesPermisosModule,
  ],
})
export class RecursosHumanosModule {}
