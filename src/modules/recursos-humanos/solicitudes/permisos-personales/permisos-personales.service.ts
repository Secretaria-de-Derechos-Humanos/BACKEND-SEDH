import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PermisoPersonal } from './entities/permiso-personal.entity';
import { InsertarPermisoPersonalDto } from './dto/insertar-permiso-personal.dto';

@Injectable()
export class PermisosPersonalesService {
  constructor(
    @InjectRepository(PermisoPersonal) private readonly repo: Repository<PermisoPersonal>,
    private readonly dataSource: DataSource,
  ) {}

  findAll() {
    return this.repo.find();
  }

  findByEmpleado(email: string) {
    return this.repo.find({ where: { emailInstitucional: email } });
  }

  async findOne(id: string) {
    const permiso = await this.repo.findOne({ where: { idPermisoPersonal: id } });
    if (!permiso) throw new NotFoundException(`Permiso personal ${id} no encontrado`);
    return permiso;
  }

  async insertarPermisoPersonal(dto: InsertarPermisoPersonalDto) {
    const rows = await this.dataSource.query(
      'SELECT rrhh.insertar_permiso_personal($1, $2, $3, $4, $5)',
      [dto.email, dto.fecha, dto.horas, dto.motivo, dto.emergencia],
    );
    return rows[0]?.insertar_permiso_personal ?? null;
  }
}
