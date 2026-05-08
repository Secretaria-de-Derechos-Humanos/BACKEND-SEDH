import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SolicitudesEmpleadosService {
  constructor(private readonly dataSource: DataSource) {}

  async getSolicitudesEmpleadoRRHH(email: string) {
    const rows = await this.dataSource.query(
      'SELECT to_json(rrhh.mis_solicitudes($1)) AS resultado',
      [email],
    );
    return rows[0]?.resultado ?? { email, solicitudes: [] };
  }

  async getMisSolicitudesEmergencia(email: string) {
    const rows = await this.dataSource.query(
      'SELECT to_json(rrhh.mis_solicitudes_emergencia($1)) AS resultado',
      [email],
    );
    return rows[0]?.resultado ?? { email, emergencias: [] };
  }
}
