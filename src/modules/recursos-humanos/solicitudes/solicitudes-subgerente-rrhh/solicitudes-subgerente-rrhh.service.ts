import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ResponderSolicitudSubgerenteDto } from './dto/responder-solicitud-subgerente.dto';

@Injectable()
export class SolicitudesSubgerenteRrhhService {
  private readonly logger = new Logger(SolicitudesSubgerenteRrhhService.name);

  constructor(private readonly dataSource: DataSource) {}

  async cargarPendientes(email: string, rol: number, modulo?: number) {
    if (!modulo) {
      throw new BadRequestException('El campo modulo es obligatorio');
    }

    try {
      const rows = await this.dataSource.query(
        'SELECT * FROM rrhh.cargar_datos_aprobar_solicitudes_rrhh($1, $2, $3)',
        [email, String(rol), String(modulo)],
      );
      const resultado = rows[0]?.cargar_datos_aprobar_solicitudes_rrhh;
      const pendientes = this.normalizarPendientes(resultado);

      return {
        rol: Number(resultado?.rol ?? rol),
        subgerente: resultado?.subgerente ?? email,
        modulo: Number(resultado?.modulo ?? resultado?.idmodulo ?? modulo),
        status: resultado?.status ?? 'OK',
        pendientesRRHH: pendientes,
        pendientes,
      };
    } catch (error) {
      this.logger.error(`Error en cargarPendientes: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }

  async responderSolicitud(dto: ResponderSolicitudSubgerenteDto) {
    const modulo = dto.modulo ?? dto.idmodulo;
    if (!modulo) {
      throw new BadRequestException('El campo modulo es obligatorio');
    }

    const esRechazo = Boolean(dto.motRechazo && dto.motRechazo.trim().length > 0);
    const motRechazo = esRechazo ? dto.motRechazo!.trim() : null;

    let horas: string | null = null;
    if (esRechazo && dto.tipo === 'PERMISO PERSONAL') {
      if (!dto.horas) {
        throw new BadRequestException(
          'El campo horas es obligatorio al rechazar un PERMISO PERSONAL',
        );
      }
      horas = dto.horas;
    }

    try {
      const rows = await this.dataSource.query(
        'SELECT rrhh.responder_solicitudes_rrhh($1, $2, $3, $4, $5, $6, $7)',
        [dto.idpermiso, dto.tipo, dto.email, String(dto.rol), String(modulo), motRechazo, horas],
      );
      return rows[0]?.responder_solicitudes_rrhh ?? null;
    } catch (error) {
      this.logger.error(`Error en responderSolicitud: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }

  private normalizarPendientes(resultado: unknown): Record<string, unknown>[] {
    if (!resultado || typeof resultado !== 'object') {
      return [];
    }

    const data = resultado as Record<string, unknown>;
    const pendientesDirectos = data.pendientes ?? data.pendientesRRHH;

    if (Array.isArray(pendientesDirectos)) {
      return pendientesDirectos as Record<string, unknown>[];
    }

    const pendientesPersonales = this.obtenerArreglo(data, [
      'pendientesPersonales',
      'permisosPersonales',
      'personales',
    ]);
    const pendientesOficiales = this.obtenerArreglo(data, [
      'pendientesOficiales',
      'permisosOficiales',
      'oficiales',
    ]);

    return [
      ...pendientesPersonales.map((item) => this.enriquecerTipo(item, 'PERMISO PERSONAL', 'PERSONAL')),
      ...pendientesOficiales.map((item) => this.enriquecerTipo(item, 'PERMISO OFICIAL', 'OFICIAL')),
    ];
  }

  private obtenerArreglo(
    data: Record<string, unknown>,
    posiblesCampos: string[],
  ): Record<string, unknown>[] {
    for (const campo of posiblesCampos) {
      const valor = data[campo];
      if (Array.isArray(valor)) {
        return valor as Record<string, unknown>[];
      }
    }
    return [];
  }

  private enriquecerTipo(
    item: Record<string, unknown>,
    tipo: 'PERMISO PERSONAL' | 'PERMISO OFICIAL',
    tipoPermiso: 'PERSONAL' | 'OFICIAL',
  ): Record<string, unknown> {
    return {
      tipo: item.tipo ?? tipo,
      tipoPermiso: item.tipoPermiso ?? tipoPermiso,
      ...item,
    };
  }
}
