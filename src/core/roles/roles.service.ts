import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from './entities/rol.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol)
    private readonly repo: Repository<Rol>,
  ) {}

  findAll(): Promise<Rol[]> {
    return this.repo.find();
  }

  async findById(idRol: number): Promise<Rol> {
    const rol = await this.repo.findOne({ where: { idRol } });
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return rol;
  }
}
