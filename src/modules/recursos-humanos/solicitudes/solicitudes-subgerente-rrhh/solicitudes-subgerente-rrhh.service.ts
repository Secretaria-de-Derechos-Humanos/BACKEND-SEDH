import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CargarPendientesSubgerenteDto } from './dto/cargar-pendientes-subgerente.dto';

@Injectable()
export class SolicitudesSubgerenteRrhhService {
  private readonly logger = new Logger(SolicitudesSubgerenteRrhhService.name);

  constructor(private readonly dataSource: DataSource) {}

  async cargarPendientes(dto: CargarPendientesSubgerenteDto) {
    try {
      const rows = await this.dataSource.query(
        'SELECT * FROM rrhh.cargar_datos_aprobar_solicitudes_rrhh($1, $2, $3)',
        [dto.email, String(dto.rol), String(dto.idmodulo)],
      );
      return rows[0]?.cargar_datos_aprobar_solicitudes_rrhh ?? { pendientesRRHH: [] };
    } catch (error) {
      this.logger.error(`Error en cargarPendientes: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }
}
