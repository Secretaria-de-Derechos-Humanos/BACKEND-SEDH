import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cargo } from './entities/cargo.entity';
import { Dependencia } from './entities/dependencia.entity';
import { Departamento } from './entities/departamento.entity';
import { Municipio } from './entities/municipio.entity';
import { Sexo } from './entities/sexo.entity';
import { EstadoCivil } from './entities/estado-civil.entity';
import { TipoContratacion } from './entities/tipo-contratacion.entity';
import { EstadoSolicitud } from './entities/estado-solicitud.entity';
import { TipoSolicitudEmpleado } from './entities/tipo-solicitud-empleado.entity';

@Injectable()
export class CatalogosService {
  constructor(
    @InjectRepository(Cargo) private readonly cargoRepo: Repository<Cargo>,
    @InjectRepository(Dependencia) private readonly dependenciaRepo: Repository<Dependencia>,
    @InjectRepository(Departamento) private readonly departamentoRepo: Repository<Departamento>,
    @InjectRepository(Municipio) private readonly municipioRepo: Repository<Municipio>,
    @InjectRepository(Sexo) private readonly sexoRepo: Repository<Sexo>,
    @InjectRepository(EstadoCivil) private readonly estadoCivilRepo: Repository<EstadoCivil>,
    @InjectRepository(TipoContratacion) private readonly tipoContratacionRepo: Repository<TipoContratacion>,
    @InjectRepository(EstadoSolicitud) private readonly estadoSolicitudRepo: Repository<EstadoSolicitud>,
    @InjectRepository(TipoSolicitudEmpleado) private readonly tipoSolicitudRepo: Repository<TipoSolicitudEmpleado>,
  ) {}

  findCargos() { return this.cargoRepo.find(); }
  findDependencias() { return this.dependenciaRepo.find(); }
  findDepartamentos() { return this.departamentoRepo.find(); }
  findMunicipios() { return this.municipioRepo.find(); }
  findSexos() { return this.sexoRepo.find(); }
  findEstadosCiviles() { return this.estadoCivilRepo.find(); }
  findTiposContrataciones() { return this.tipoContratacionRepo.find(); }
  findEstadosSolicitudes() { return this.estadoSolicitudRepo.find(); }
  findTiposSolicitudesEmpleados() { return this.tipoSolicitudRepo.find(); }
}
