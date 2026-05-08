import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PermisoOficial } from './entities/permiso-oficial.entity';
import { InsertarPermisoOficialDto } from './dto/insertar-permiso-oficial.dto';

@Injectable()
export class PermisosOficialesService {
  constructor(
    @InjectRepository(PermisoOficial) private readonly repo: Repository<PermisoOficial>,
    private readonly dataSource: DataSource,
  ) {}

  findAll() {
    return this.repo.find();
  }

  findByEmpleado(email: string) {
    return this.repo.find({ where: { emailInstitucional: email } });
  }

  async findOne(id: string) {
    const permiso = await this.repo.findOne({ where: { idPermisoOficial: id } });
    if (!permiso) throw new NotFoundException(`Permiso oficial ${id} no encontrado`);
    return permiso;
  }

  async insertarPermisoOficial(dto: InsertarPermisoOficialDto) {
    const rows = await this.dataSource.query('SELECT rrhh.insertar_permiso_oficial($1, $2, $3)', [
      dto.email,
      dto.fecha,
      dto.motivo,
    ]);
    return rows[0]?.insertar_permiso_oficial ?? null;
  }
}
