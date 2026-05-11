import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReportePermisosMesDto } from './dto/reporte-permisos-mes.dto';

@Injectable()
export class ReportesPermisosService {
  private readonly logger = new Logger(ReportesPermisosService.name);

  constructor(private readonly dataSource: DataSource) {}

  async reportePermisosMes(dto: ReportePermisosMesDto) {
    try {
      const rows = await this.dataSource.query(
        'SELECT rrhh.cargar_reporte_permisos_empleados_mes($1, $2, $3, $4, $5)',
        [dto.mes, dto.anio, dto.email, String(dto.rol), String(dto.idmodulo)],
      );
      return rows[0]?.cargar_reporte_permisos_empleados_mes ?? { reportePermisos: [] };
    } catch (error) {
      this.logger.error(`Error en reportePermisosMes: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }
}
