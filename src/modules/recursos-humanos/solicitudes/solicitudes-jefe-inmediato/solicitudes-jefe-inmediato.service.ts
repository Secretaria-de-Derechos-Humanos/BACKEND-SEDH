import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ResponderSolicitudJefeDto } from './dto/responder-solicitud-jefe.dto';

@Injectable()
export class SolicitudesJefeInmediatoService {
  private readonly logger = new Logger(SolicitudesJefeInmediatoService.name);

  constructor(private readonly dataSource: DataSource) {}

  async cargarDatosAprobarJefeInmediato(email: string, rol: number, modulo: number) {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT rrhh.cargar_datos_aprobar_jefe_inmediato(
          $1::character varying,
          $2::smallint,
          $3::smallint
        ) AS resultado
        `,
        [email, Number(rol), Number(modulo)],
      );

      const resultado = rows[0]?.resultado;
      const pendientes = this.normalizarPendientes(resultado);

      return {
        status: resultado?.status ?? 'OK',
        rol: Number(resultado?.rol ?? rol),
        jefe: resultado?.jefe ?? email,
        modulo: Number(resultado?.modulo ?? resultado?.idmodulo ?? modulo),
        pendientes,
      };
    } catch (error) {
      this.manejarError(
        'cargarDatosAprobarJefeInmediato',
        error,
        'No se pudieron cargar las solicitudes pendientes',
      );
    }
  }

  async responderSolicitud(dto: ResponderSolicitudJefeDto, email: string, rol: number) {
    const motivoLimpio = dto.motRechazo?.trim();
    const esRechazo = Boolean(motivoLimpio);

    const motivoRechazo = esRechazo ? motivoLimpio! : null;

    let horas: string | null = null;

    if (esRechazo && dto.tipo === 'PERMISO PERSONAL') {
      const horasLimpias = dto.horas?.trim();

      if (!horasLimpias) {
        throw new BadRequestException(
          'El campo horas es obligatorio al rechazar un PERMISO PERSONAL',
        );
      }

      horas = horasLimpias;
    }

    try {
      const rows = await this.dataSource.query(
        `
  SELECT rrhh.responder_solicitudes_jefe_i(
    $1::uuid,
    $2::character varying,
    $3::character varying,
    $4::smallint,
    $5::smallint,
    $6::character varying,
    $7::time
  ) AS resultado
  `,
        [dto.idpermiso, dto.tipo, email, Number(rol), Number(dto.modulo), motivoRechazo, horas],
      );

      return rows[0]?.resultado ?? null;
    } catch (error) {
      this.manejarError('responderSolicitud', error, 'No se pudo responder la solicitud');
    }
  }

  private normalizarPendientes(resultado: unknown): Record<string, unknown>[] {
    if (!resultado || typeof resultado !== 'object') {
      return [];
    }

    const data = resultado as Record<string, unknown>;

    if (Array.isArray(data['pendientes'])) {
      return data['pendientes'] as Record<string, unknown>[];
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
      ...pendientesPersonales.map((item) =>
        this.enriquecerTipo(item, 'PERMISO PERSONAL', 'PERSONAL'),
      ),
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
      tipo: item['tipo'] ?? tipo,
      tipoPermiso: item['tipoPermiso'] ?? tipoPermiso,
      ...item,
    };
  }

  private manejarError(metodo: string, error: unknown, mensaje: string): never {
    this.logger.error(`Error en ${metodo}`, error instanceof Error ? error.stack : String(error));

    if (error instanceof HttpException) {
      throw error;
    }

    throw new InternalServerErrorException(mensaje);
  }
}
