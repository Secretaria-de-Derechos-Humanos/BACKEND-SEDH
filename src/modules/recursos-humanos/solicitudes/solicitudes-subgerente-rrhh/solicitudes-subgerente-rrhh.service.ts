import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CargarPendientesSubgerenteDto } from './dto/cargar-pendientes-subgerente.dto';
import { ResponderSolicitudSubgerenteDto } from './dto/responder-solicitud-subgerente.dto';

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

  async responderSolicitud(dto: ResponderSolicitudSubgerenteDto) {
    try {
      const rows = await this.dataSource.query(
        'SELECT rrhh.responder_solicitudes_rrhh($1, $2, $3, $4, $5, $6, $7)',
        [
          dto.idpermiso,
          dto.tipo,
          dto.email,
          String(dto.rol),
          String(dto.idmodulo),
          dto.motRechazo ?? null,
          dto.horas ?? null,
        ],
      );
      return rows[0]?.responder_solicitudes_rrhh ?? null;
    } catch (error) {
      this.logger.error(`Error en responderSolicitud: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }
}
