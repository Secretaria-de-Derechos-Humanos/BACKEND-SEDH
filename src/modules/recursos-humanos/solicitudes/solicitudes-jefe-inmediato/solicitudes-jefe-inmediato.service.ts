import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
}
