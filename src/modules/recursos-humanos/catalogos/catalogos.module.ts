import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosService } from './catalogos.service';
import { CatalogosController } from './catalogos.controller';
import { Cargo } from './entities/cargo.entity';
import { Dependencia } from './entities/dependencia.entity';
import { Departamento } from './entities/departamento.entity';
import { Municipio } from './entities/municipio.entity';
import { Sexo } from './entities/sexo.entity';
import { EstadoCivil } from './entities/estado-civil.entity';
import { TipoContratacion } from './entities/tipo-contratacion.entity';
import { EstadoSolicitud } from './entities/estado-solicitud.entity';
import { TipoSolicitudEmpleado } from './entities/tipo-solicitud-empleado.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cargo,
      Dependencia,
      Departamento,
      Municipio,
      Sexo,
      EstadoCivil,
      TipoContratacion,
      EstadoSolicitud,
      TipoSolicitudEmpleado,
    ]),
  ],
  controllers: [CatalogosController],
  providers: [CatalogosService],
  exports: [TypeOrmModule, CatalogosService],
})
export class CatalogosModule {}
