import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asistencia } from './entities/asistencia.entity';
import { CrearAsistenciaDto } from './dto/crear-asistencia.dto';
import { ActualizarAsistenciaDto } from './dto/actualizar-asistencia.dto';

@Injectable()
export class AsistenciasService {
  constructor(
    @InjectRepository(Asistencia)
    private readonly asistenciaRepo: Repository<Asistencia>,
  ) {}

  listarTodas(): Promise<Asistencia[]> {
    return this.asistenciaRepo.find({ order: { fechaAsistencia: 'DESC' } });
  }

  listarPorEmpleado(empleadoId: string): Promise<Asistencia[]> {
    return this.asistenciaRepo.find({
      where: { empleadoId },
      order: { fechaAsistencia: 'DESC' },
    });
  }

  async obtenerUna(id: string): Promise<Asistencia> {
    const registro = await this.asistenciaRepo.findOne({ where: { id } });
    if (!registro) throw new NotFoundException('Registro de asistencia no encontrado');
    return registro;
  }

  crear(dto: CrearAsistenciaDto): Promise<Asistencia> {
    return this.asistenciaRepo.save(this.asistenciaRepo.create(dto));
  }

  async actualizar(id: string, dto: ActualizarAsistenciaDto): Promise<Asistencia> {
    const registro = await this.obtenerUna(id);
    Object.assign(registro, dto);
    return this.asistenciaRepo.save(registro);
  }

  async eliminar(id: string): Promise<void> {
    const registro = await this.obtenerUna(id);
    await this.asistenciaRepo.softRemove(registro);
  }
}
