import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SolicitudesEmpleadosService {
  constructor(private readonly dataSource: DataSource) {}

  async getSolicitudesEmpleadoRRHH(email: string) {
    const rows = await this.dataSource.query('SELECT * FROM rrhh.mis_solicitudes($1)', [email]);
    return { email, solicitudes: rows };
  }

  async getMisSolicitudesEmergencia(email: string) {
    const rows = await this.dataSource.query('SELECT * FROM rrhh.mis_solicitudes_emergencia($1)', [
      email,
    ]);
    return { email, emergencias: rows };
  }
}
