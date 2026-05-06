import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermisoOficial } from './entities/permiso-oficial.entity';

@Injectable()
export class PermisosOficialesService {
  constructor(
    @InjectRepository(PermisoOficial) private readonly repo: Repository<PermisoOficial>,
  ) {}

  findAll() { return this.repo.find(); }

  findByEmpleado(email: string) { return this.repo.find({ where: { emailInstitucional: email } }); }

  async findOne(id: string) {
    const permiso = await this.repo.findOne({ where: { idPermisoOficial: id } });
    if (!permiso) throw new NotFoundException(`Permiso oficial ${id} no encontrado`);
    return permiso;
  }
}
