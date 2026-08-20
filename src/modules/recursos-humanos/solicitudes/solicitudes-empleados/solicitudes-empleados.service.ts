import { HttpException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SolicitudesEmpleadosService {
  private readonly logger = new Logger(SolicitudesEmpleadosService.name);
  constructor(private readonly dataSource: DataSource) {}

  async getSolicitudesEmpleadoRRHH(email: string) {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT rrhh.mis_solicitudes($1) AS resultado
        `,
        [email],
      );

      return rows[0]?.resultado;
    } catch (error) {
      this.manejarError(
        'getSolicitudesEmpleadoRRHH',
        error,
        'No se pudieron obtener las solicitudes',
      );
    }
  }

  async getMisSolicitudesEmergencia(email: string) {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT rrhh.mis_solicitudes_emergencia($1) AS resultado
        `,
        [email],
      );

      return rows[0]?.resultado;
    } catch (error) {
      this.manejarError(
        'getMisSolicitudesEmergencia',
        error,
        'No se pudieron obtener las solicitudes de emergencia',
      );
    }
  }

  async cargarDatosAgregarPermisos(email: string) {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT rrhh.cargar_datos_para_agregar_permisos($1) AS resultado
        `,
        [email],
      );

      return rows[0]?.resultado;
    } catch (error) {
      this.manejarError(
        'cargarDatosAgregarPermisos',
        error,
        'No se pudieron cargar los datos del permiso',
      );
    }
  }

  private manejarError(metodo: string, error: unknown, mensaje: string): never {
    this.logger.error(metodo, error instanceof Error ? error.stack : String(error));

    if (error instanceof HttpException) {
      throw error;
    }

    throw new InternalServerErrorException(mensaje);
  }
}
