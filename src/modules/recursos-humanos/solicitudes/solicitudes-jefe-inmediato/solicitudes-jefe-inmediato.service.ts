import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ResponderSolicitudJefeDto } from './dto/responder-solicitud-jefe.dto';

@Injectable()
export class SolicitudesJefeInmediatoService {
  private readonly logger = new Logger(SolicitudesJefeInmediatoService.name);

  constructor(private readonly dataSource: DataSource) {}

  async cargarDatosAprobarJefeInmediato(email: string, rol: number, idmodulo: number) {
    try {
      const rows = await this.dataSource.query(
        'SELECT * FROM rrhh.cargar_datos_aprobar_jefe_inmediato($1, $2, $3)',
        [email, String(rol), String(idmodulo)],
      );
      this.logger.debug(`rows: ${JSON.stringify(rows)}`);
      return rows[0]?.cargar_datos_aprobar_jefe_inmediato ?? { jefe: email, pendientes: [] };
    } catch (error) {
      this.logger.error(`Error en cargarDatosAprobarJefeInmediato: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }

  async responderSolicitud(dto: ResponderSolicitudJefeDto) {
    try {
      const rows = await this.dataSource.query(
        'SELECT rrhh.responder_solicitudes_jefe_i($1, $2, $3, $4, $5, $6, $7)',
        [
          dto.idpermiso,
          dto.tipo,
          dto.email,
          String(dto.rol),
          String(dto.idmodulo),
          dto.motRechazo ?? null,
          dto.horas,
        ],
      );
      return rows[0]?.responder_solicitudes_jefe_i ?? null;
    } catch (error) {
      this.logger.error(`Error en responderSolicitud: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }
}
