import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SolicitudesJefeInmediatoService {
  constructor(private readonly dataSource: DataSource) {}

  async cargarDatosAprobarJefeInmediato(email: string) {
    const rows = await this.dataSource.query(
      'SELECT to_json(rrhh.cargar_datos_aprobar_jefe_inmediato($1)) AS resultado',
      [email],
    );
    return rows[0]?.resultado ?? { jefe: email, pendientes: [] };
  }
}
