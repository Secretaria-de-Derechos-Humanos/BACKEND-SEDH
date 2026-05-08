import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermisoPersonal } from './entities/permiso-personal.entity';

@Injectable()
export class PermisosPersonalesService {
  constructor(
    @InjectRepository(PermisoPersonal) private readonly repo: Repository<PermisoPersonal>,
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
}
