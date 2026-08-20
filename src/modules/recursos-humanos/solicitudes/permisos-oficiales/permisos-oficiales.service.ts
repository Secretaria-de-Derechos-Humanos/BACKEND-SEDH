import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { PermisoOficial } from './entities/permiso-oficial.entity';
import { InsertarPermisoOficialDto } from './dto/insertar-permiso-oficial.dto';

@Injectable()
export class PermisosOficialesService {
  private readonly logger = new Logger(PermisosOficialesService.name);

  constructor(
    @InjectRepository(PermisoOficial)
    private readonly repo: Repository<PermisoOficial>,

    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<PermisoOficial[]> {
    return this.repo.find();
  }

  findByEmpleado(email: string): Promise<PermisoOficial[]> {
    return this.repo.find({
      where: {
        emailInstitucional: email,
      },
    });
  }

  async findOne(id: string): Promise<PermisoOficial> {
    const permiso = await this.repo.findOne({
      where: {
        idPermisoOficial: id,
      },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso oficial ${id} no encontrado`);
    }

    return permiso;
  }

  async insertarPermisoOficial(dto: InsertarPermisoOficialDto, email: string): Promise<unknown> {
    try {
      const rows = await this.dataSource.query(
        `
      SELECT rrhh.insertar_permiso_oficial(
        $1::character varying,
        $2::date,
        $3::character varying
      ) AS resultado
      `,
        [email, dto.fecha, dto.motivo.trim()],
      );

      return rows[0]?.resultado ?? null;
    } catch (error) {
      this.logger.error(
        'Error en insertarPermisoOficial',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('No se pudo registrar el permiso oficial');
    }
  }
}
