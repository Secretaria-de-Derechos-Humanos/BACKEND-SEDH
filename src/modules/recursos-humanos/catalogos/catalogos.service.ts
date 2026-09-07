import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

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

import { CrearCargoDto } from './dto/crear-cargo.dto';
import { ActualizarCargoDto } from './dto/actualizar-cargo.dto';

@Injectable()
export class CatalogosService {
  constructor(
    @InjectRepository(Cargo)
    private readonly cargoRepo: Repository<Cargo>,

    @InjectRepository(Dependencia)
    private readonly dependenciaRepo: Repository<Dependencia>,

    @InjectRepository(Departamento)
    private readonly departamentoRepo: Repository<Departamento>,

    @InjectRepository(Municipio)
    private readonly municipioRepo: Repository<Municipio>,

    @InjectRepository(Sexo)
    private readonly sexoRepo: Repository<Sexo>,

    @InjectRepository(EstadoCivil)
    private readonly estadoCivilRepo: Repository<EstadoCivil>,

    @InjectRepository(TipoContratacion)
    private readonly tipoContratacionRepo: Repository<TipoContratacion>,

    @InjectRepository(EstadoSolicitud)
    private readonly estadoSolicitudRepo: Repository<EstadoSolicitud>,

    @InjectRepository(TipoSolicitudEmpleado)
    private readonly tipoSolicitudRepo: Repository<TipoSolicitudEmpleado>,
  ) {}

  // ============================================================
  // CATÁLOGOS EXISTENTES
  // ============================================================

  findCargos() {
    return this.cargoRepo.find({
      relations: ['dependencia'],
      order: {
        nomCargo: 'ASC',
      },
    });
  }

  findDependencias() {
    return this.dependenciaRepo.find({
      order: {
        nomDependencia: 'ASC',
      },
    });
  }

  findDepartamentos() {
    return this.departamentoRepo.find();
  }

  findMunicipios() {
    return this.municipioRepo.find();
  }

  findSexos() {
    return this.sexoRepo.find();
  }

  findEstadosCiviles() {
    return this.estadoCivilRepo.find();
  }

  findTiposContrataciones() {
    return this.tipoContratacionRepo.find();
  }

  findEstadosSolicitudes() {
    return this.estadoSolicitudRepo.find();
  }

  findTiposSolicitudesEmpleados() {
    return this.tipoSolicitudRepo.find();
  }

  // ============================================================
  // CARGOS
  // ============================================================

  async crearCargo(dto: CrearCargoDto, creadoPor?: string): Promise<Cargo> {
    const dependencia = await this.dependenciaRepo.findOne({
      where: {
        idDependencia: dto.idDependencia,
      },
    });

    if (!dependencia) {
      throw new NotFoundException('La dependencia indicada no existe');
    }

    const nombreCargo = dto.nomCargo.trim();

    if (!nombreCargo) {
      throw new BadRequestException('El nombre del cargo es obligatorio');
    }

    const cargoExistente = await this.cargoRepo
      .createQueryBuilder('cargo')
      .where('LOWER(cargo.nomcargo) = LOWER(:nombre)', {
        nombre: nombreCargo,
      })
      .andWhere('cargo.iddependencia = :idDependencia', {
        idDependencia: dto.idDependencia,
      })
      .getOne();

    if (cargoExistente) {
      throw new BadRequestException(
        'Ya existe un cargo con ese nombre en la dependencia seleccionada',
      );
    }

    const ultimoCargo = await this.cargoRepo
      .createQueryBuilder('cargo')
      .select('COALESCE(MAX(cargo.idCargo), 0)', 'max')
      .getRawOne();

    const nuevoId = Number(ultimoCargo?.max ?? 0) + 1;

    const cargo = this.cargoRepo.create({
      idCargo: nuevoId,
      nomCargo: nombreCargo,
      idDependencia: dto.idDependencia,
      creadoPor: creadoPor ?? null,
    });

    return this.cargoRepo.save(cargo);
  }

  async actualizarCargo(
    idCargo: number,
    dto: ActualizarCargoDto,
    actualizadoPor?: string,
  ): Promise<Cargo> {
    const cargo = await this.cargoRepo.findOne({
      where: {
        idCargo,
      },
    });

    if (!cargo) {
      throw new NotFoundException('El cargo no existe');
    }

    if (dto.idDependencia) {
      const dependencia = await this.dependenciaRepo.findOne({
        where: {
          idDependencia: dto.idDependencia,
        },
      });

      if (!dependencia) {
        throw new NotFoundException('La dependencia indicada no existe');
      }

      cargo.idDependencia = dto.idDependencia;
    }

    if (dto.nomCargo !== undefined) {
      const nombreCargo = dto.nomCargo.trim();

      if (!nombreCargo) {
        throw new BadRequestException('El nombre del cargo es obligatorio');
      }

      cargo.nomCargo = nombreCargo;
    }

    cargo.actualizadoPor = actualizadoPor ?? null;

    return this.cargoRepo.save(cargo);
  }

  async eliminarCargo(idCargo: number): Promise<{ message: string }> {
    const cargo = await this.cargoRepo.findOne({
      where: {
        idCargo,
      },
    });

    if (!cargo) {
      throw new NotFoundException('El cargo no existe');
    }

    try {
      await this.cargoRepo.remove(cargo);

      return {
        message: 'Cargo eliminado correctamente',
      };
    } catch (error) {
      throw new BadRequestException(
        'No se puede eliminar el cargo porque probablemente está siendo utilizado por un empleado',
      );
    }
  }

  async findCargosPorDependencia(idDependencia: number) {
    const dependencia = await this.dependenciaRepo.findOne({
      where: {
        idDependencia,
      },
    });

    if (!dependencia) {
      throw new NotFoundException('La dependencia no existe');
    }

    return this.cargoRepo.find({
      where: {
        idDependencia,
      },
      order: {
        nomCargo: 'ASC',
      },
    });
  }
}
