import { Module } from '@nestjs/common';
import { CatalogosModule } from './catalogos/catalogos.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { PermisosOficialesModule } from './solicitudes/permisos-oficiales/permisos-oficiales.module';
import { PermisosPersonalesModule } from './solicitudes/permisos-personales/permisos-personales.module';
import { VacacionesModule } from './solicitudes/vacaciones/vacaciones.module';

@Module({
  imports: [
    CatalogosModule,
    EmpleadosModule,
    PermisosOficialesModule,
    PermisosPersonalesModule,
    VacacionesModule,
  ],
})
export class RecursosHumanosModule {}
