import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportePermiso } from './entities/reporte-permiso.entity';
import { CrearReportePermisoDto } from './dto/crear-reporte-permiso.dto';
import { RevisarReportePermisoDto } from './dto/revisar-reporte-permiso.dto';

@Injectable()
export class ReportesPermisosService {
  constructor(
    @InjectRepository(ReportePermiso)
    private readonly reporteRepo: Repository<ReportePermiso>,
  ) {}

  listarTodos(): Promise<ReportePermiso[]> {
    return this.reporteRepo.find({ order: { createdAt: 'DESC' } });
  }

  listarPorEmpleado(empleadoId: string): Promise<ReportePermiso[]> {
    return this.reporteRepo.find({
      where: { empleadoId },
      order: { createdAt: 'DESC' },
    });
  }

  async obtenerUno(id: string): Promise<ReportePermiso> {
    const reporte = await this.reporteRepo.findOne({ where: { id } });
    if (!reporte) throw new NotFoundException('Reporte de permiso no encontrado');
    return reporte;
  }

  async crear(dto: CrearReportePermisoDto): Promise<ReportePermiso> {
    const inicio = new Date(dto.fechaInicio);
    const fin = new Date(dto.fechaFin);
    const totalDias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const reporte = this.reporteRepo.create({ ...dto, totalDias });
    return this.reporteRepo.save(reporte);
  }

  async revisar(id: string, dto: RevisarReportePermisoDto): Promise<ReportePermiso> {
    const reporte = await this.obtenerUno(id);
    Object.assign(reporte, { ...dto, revisadoEn: new Date() });
    return this.reporteRepo.save(reporte);
  }

  async eliminar(id: string): Promise<void> {
    const reporte = await this.obtenerUno(id);
    await this.reporteRepo.softRemove(reporte);
  }
}
