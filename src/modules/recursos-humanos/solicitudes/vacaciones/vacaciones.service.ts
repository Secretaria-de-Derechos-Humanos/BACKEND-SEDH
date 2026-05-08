import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vacacion } from './entities/vacacion.entity';

@Injectable()
export class VacacionesService {
  constructor(@InjectRepository(Vacacion) private readonly repo: Repository<Vacacion>) {}

  findAll() {
    return this.repo.find();
  }

  findByEmpleado(email: string) {
    return this.repo.find({ where: { emailInstitucional: email } });
  }

  async findOne(id: string) {
    const vacacion = await this.repo.findOne({ where: { idPermisoVaca: id } });
    if (!vacacion) throw new NotFoundException(`Vacación ${id} no encontrada`);
    return vacacion;
  }
}
