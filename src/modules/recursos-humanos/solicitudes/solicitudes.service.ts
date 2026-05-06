import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolicitudEmpleado } from './entities/solicitud-empleado.entity';
import { CrearSolicitudEmpleadoDto } from './dto/crear-solicitud-empleado.dto';
import { ActualizarSolicitudEmpleadoDto } from './dto/actualizar-solicitud-empleado.dto';

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(SolicitudEmpleado)
    private readonly solicitudRepo: Repository<SolicitudEmpleado>,
  ) {}

  listarTodas(): Promise<SolicitudEmpleado[]> {
    return this.solicitudRepo.find({ order: { createdAt: 'DESC' } });
  }

  listarPorEmpleado(empleadoId: string): Promise<SolicitudEmpleado[]> {
    return this.solicitudRepo.find({
      where: { empleadoId },
      order: { createdAt: 'DESC' },
    });
  }

  async obtenerUna(id: string): Promise<SolicitudEmpleado> {
    const solicitud = await this.solicitudRepo.findOne({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    return solicitud;
  }

  crear(dto: CrearSolicitudEmpleadoDto): Promise<SolicitudEmpleado> {
    return this.solicitudRepo.save(this.solicitudRepo.create(dto));
  }

  async actualizar(id: string, dto: ActualizarSolicitudEmpleadoDto): Promise<SolicitudEmpleado> {
    const solicitud = await this.obtenerUna(id);
    if (dto.estado === 'completado' || dto.estado === 'rechazado') {
      (dto as any).resueltoEn = new Date();
    }
    Object.assign(solicitud, dto);
    return this.solicitudRepo.save(solicitud);
  }

  async eliminar(id: string): Promise<void> {
    const solicitud = await this.obtenerUna(id);
    await this.solicitudRepo.softRemove(solicitud);
  }
}
