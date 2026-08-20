import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReportePermisosMesDto } from './dto/reporte-permisos-mes.dto';

@Injectable()
export class ReportesPermisosService {
  private readonly logger = new Logger(ReportesPermisosService.name);
  constructor(private readonly dataSource: DataSource) {}

  async reportePermisosMes(dto: ReportePermisosMesDto, email: string, rol: number) {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT rrhh.cargar_reporte_permisos_empleados_mes(
          $1::integer,
          $2::integer,
          $3::character varying,
          $4::integer,
          $5::integer
        ) AS resultado
        `,
        [Number(dto.mes), Number(dto.anio), email, Number(rol), Number(dto.idmodulo)],
      );

      return (
        rows[0]?.resultado ?? {
          reportePermisos: [],
        }
      );
    } catch (error: unknown) {
      this.logger.error(
        'Error en reportePermisosMes',
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException('No se pudo generar el reporte de permisos');
    }
  }
}
