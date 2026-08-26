import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';

import { InsertarPermisoPersonalDto } from './dto/insertar-permiso-personal.dto';
import { PermisoPersonal } from './entities/permiso-personal.entity';

interface DisponibilidadRow {
  hordisponibles: string | null;
  consumidodia: number | string | null;
  consumidomes: number | string | null;
}

export interface ResultadoPermisoPersonal {
  status?: string;
  message?: string;
  detalle?: string;
  [key: string]: unknown;
}

interface ResultadoFuncionRow {
  resultado: ResultadoPermisoPersonal | null;
}

@Injectable()
export class PermisosPersonalesService {
  private readonly logger = new Logger(PermisosPersonalesService.name);

  constructor(
    @InjectRepository(PermisoPersonal)
    private readonly repo: Repository<PermisoPersonal>,

    private readonly dataSource: DataSource,
  ) {}

  // ============================================================
  // LISTAR TODOS
  // ============================================================

  findAll(): Promise<PermisoPersonal[]> {
    return this.repo.find({
      order: {
        fecSolicitud: 'DESC',
      },
    });
  }

  // ============================================================
  // LISTAR POR EMPLEADO
  // ============================================================

  findByEmpleado(email: string): Promise<PermisoPersonal[]> {
    return this.repo.find({
      where: {
        emailInstitucional: email,
      },
      order: {
        fecSolicitud: 'DESC',
      },
    });
  }

  // ============================================================
  // BUSCAR UNO
  // ============================================================

  async findOne(id: string): Promise<PermisoPersonal> {
    const permiso = await this.repo.findOne({
      where: {
        idPermisoPersonal: id,
      },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso personal ${id} no encontrado`);
    }

    return permiso;
  }

  // ============================================================
  // DATOS DEL EMPLEADO AUTENTICADO
  // ============================================================

  async obtenerDatosPermiso(email: string) {
    const rows = await this.dataSource.query(
      `
      SELECT
        rrhh.cargar_datos_para_agregar_permisos($1) AS resultado
    `,
      [email],
    );

    const resultado = rows?.[0]?.resultado;

    this.logger.log(`Datos permiso para ${email}: ${JSON.stringify(resultado)}`);

    if (!resultado) {
      throw new NotFoundException('No se encontraron datos del empleado');
    }

    // Normalizamos la respuesta para que Angular
    // siempre reciba exactamente los nombres que espera.
    const data = {
      prinombre: resultado.prinombre ?? resultado.priNombre ?? resultado.nombre ?? '',

      segnombre: resultado.segnombre ?? resultado.segNombre ?? '',

      priapellido: resultado.priapellido ?? resultado.priApellido ?? '',

      segapellido: resultado.segapellido ?? resultado.segApellido ?? '',

      dependencia: resultado.dependencia ?? '',

      cargo: resultado.cargo ?? '',

      horas_disponibles:
        resultado.horas_disponibles ??
        resultado.horasDisponibles ??
        resultado.hordisponibles ??
        '00:00:00',
    };

    return {
      success: true,
      data,
      message: 'Datos del empleado obtenidos correctamente',
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // INSERTAR PERMISO PERSONAL
  // ============================================================

  async insertarPermisoPersonal(
    dto: InsertarPermisoPersonalDto,
    email: string,
  ): Promise<ResultadoPermisoPersonal> {
    try {
      const rows = (await this.dataSource.query(
        `
        SELECT rrhh.insertar_permiso_personal(
          $1::character varying,
          $2::date,
          $3::time without time zone,
          $4::character varying,
          $5::boolean
        ) AS resultado
        `,
        [email, dto.fecha, dto.horas, dto.motivo.trim(), dto.emergencia],
      )) as ResultadoFuncionRow[];

      const resultado = rows[0]?.resultado;

      if (!resultado) {
        throw new InternalServerErrorException('La función no devolvió ningún resultado');
      }

      if (String(resultado.status).toUpperCase() !== 'OK') {
        throw new BadRequestException(
          resultado.message ?? 'No se pudo registrar el permiso personal',
        );
      }

      return resultado;
    } catch (error: unknown) {
      this.logger.error(
        'Error en insertarPermisoPersonal',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('No se pudo registrar el permiso personal');
    }
  }

  // ============================================================
  // ANULAR PERMISO PERSONAL
  // ============================================================

  async anularPermisoPersonal(idPermiso: string, email: string): Promise<ResultadoPermisoPersonal> {
    return this.dataSource.transaction(async (manager) => {
      const permisos = await manager.query(
        `
        SELECT
          pp.idpermisopersonal,
          pp.emailinstitucional,
          pp.horsolicitadas,
          pp.horsalida,
          pp.horretorno,
          pp.idestadosolicitud,

          UPPER(TRIM(es.nomestado)) AS nomestado

        FROM rrhh.permisos_personales pp

        INNER JOIN rrhh.estados_solicitudes es
          ON es.idestadosolicitud =
             pp.idestadosolicitud

        WHERE pp.idpermisopersonal =
              $1::uuid

          AND LOWER(TRIM(pp.emailinstitucional)) =
              LOWER(TRIM($2))

        FOR UPDATE
        `,
        [idPermiso, email],
      );

      const permiso = permisos?.[0];

      if (!permiso) {
        throw new NotFoundException('El permiso no existe o no pertenece al usuario autenticado');
      }

      if (permiso.nomestado !== 'APROBADO') {
        throw new BadRequestException('Solo se pueden anular permisos que estén aprobados');
      }

      if (permiso.horsalida) {
        throw new BadRequestException(
          'No se puede anular el permiso porque ya se registró la hora de salida',
        );
      }

      if (permiso.horretorno) {
        throw new BadRequestException(
          'No se puede anular el permiso porque ya se registró la hora de retorno',
        );
      }

      const estadosAnulado = await manager.query(
        `
        SELECT idestadosolicitud

        FROM rrhh.estados_solicitudes

        WHERE UPPER(TRIM(nomestado)) =
              'ANULADO'

        LIMIT 1
        `,
      );

      if (!estadosAnulado?.length) {
        throw new InternalServerErrorException('No se encontró el estado ANULADO');
      }

      const idEstadoAnulado = estadosAnulado[0].idestadosolicitud;

      await manager.query(
        `
        UPDATE rrhh.permisos_personales

        SET
          idestadosolicitud = $2::uuid,
          actualizadoen = CURRENT_DATE,
          actualizadopor = $3

        WHERE idpermisopersonal =
              $1::uuid
        `,
        [idPermiso, idEstadoAnulado, email],
      );

      if (permiso.horsolicitadas) {
        await manager.query(
          `
          UPDATE rrhh.horas_disponibles

          SET
            hordisponibles =
              hordisponibles +
              (
                $2::time -
                TIME '00:00:00'
              ),

            actualizadoen = CURRENT_DATE,

            actualizadopor = $3

          WHERE LOWER(TRIM(emailinstitucional)) =
                LOWER(TRIM($1))
          `,
          [email, permiso.horsolicitadas, email],
        );
      }

      return {
        status: 'OK',
        message: 'Permiso personal anulado correctamente',
        idPermiso,
      };
    });
  }

  // ============================================================
  // CONSULTAR DISPONIBILIDAD
  // ============================================================

  async consultarDisponibilidad(email: string, fecha: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('La fecha debe tener el formato YYYY-MM-DD');
    }

    const rows = (await this.dataSource.query(
      `
      WITH consumos AS (
        SELECT
          pp.fecsolicitud,

          CASE
            WHEN UPPER(TRIM(es.nomestado))
                 IN ('RECHAZADO', 'ANULADO')
              THEN 0

            WHEN pp.horsalida IS NOT NULL
                 AND pp.horretorno IS NOT NULL

              THEN GREATEST(
                EXTRACT(
                  EPOCH FROM (
                    pp.horretorno -
                    pp.horsalida
                  )
                ) / 60,
                0
              )

            ELSE
              EXTRACT(
                EPOCH FROM pp.horsolicitadas
              ) / 60

          END AS minutos_consumidos

        FROM rrhh.permisos_personales pp

        INNER JOIN rrhh.estados_solicitudes es
          ON es.idestadosolicitud =
             pp.idestadosolicitud

        WHERE LOWER(TRIM(pp.emailinstitucional)) =
              LOWER(TRIM($1))

          AND EXTRACT(
                YEAR FROM pp.fecsolicitud
              ) =
              EXTRACT(
                YEAR FROM $2::date
              )

          AND EXTRACT(
                MONTH FROM pp.fecsolicitud
              ) =
              EXTRACT(
                MONTH FROM $2::date
              )
      )

      SELECT

        (
          SELECT
            hd.hordisponibles::text

          FROM rrhh.horas_disponibles hd

          WHERE LOWER(TRIM(hd.emailinstitucional)) =
                LOWER(TRIM($1))

          LIMIT 1

        ) AS hordisponibles,

        COALESCE(
          SUM(minutos_consumidos)
            FILTER (
              WHERE fecsolicitud =
                    $2::date
            ),
          0
        ) AS consumidodia,

        COALESCE(
          SUM(minutos_consumidos),
          0
        ) AS consumidomes

      FROM consumos
      `,
      [email, fecha],
    )) as DisponibilidadRow[];

    const consumidoDia = Math.round(Number(rows[0]?.consumidodia ?? 0));

    const consumidoMes = Math.round(Number(rows[0]?.consumidomes ?? 0));

    const disponibleDia = Math.max(0, 180 - consumidoDia);

    const disponibleMes = Math.max(0, 540 - consumidoMes);

    return {
      fecha,

      limiteDiarioMinutos: 180,

      consumidoDiaMinutos: consumidoDia,

      disponibleDiaMinutos: disponibleDia,

      limiteMensualMinutos: 540,

      consumidoMesMinutos: consumidoMes,

      disponibleMesMinutos: disponibleMes,

      horasDisponibles: rows[0]?.hordisponibles ?? '00:00:00',
    };
  }

  // ============================================================
  // SOLICITUDES PARA AGENTE
  // ============================================================

  async listarSolicitudesAgente() {
    const rows = await this.dataSource.query(
      `
      SELECT
        pp.idpermisopersonal AS "idPermiso",

        pp.emailinstitucional AS
          "emailInstitucional",

        pp.fecsolicitud AS fecha,

        pp.horsolicitadas::text AS
          "horasSolicitadas",

        pp.horsalida::text AS
          "horaSalida",

        pp.horretorno::text AS
          "horaRetorno",

        pp.motivo,

        CONCAT_WS(
          ' ',
          e.prinombre,
          e.segnombre,
          e.priapellido,
          e.segapellido
        ) AS empleado,

        c.nomcargo AS cargo,

        d.nomdependencia AS dependencia

      FROM rrhh.permisos_personales pp

      INNER JOIN rrhh.estados_solicitudes es
        ON es.idestadosolicitud =
           pp.idestadosolicitud

      INNER JOIN rrhh.empleados e
        ON LOWER(TRIM(e.emailinstitucional)) =
           LOWER(TRIM(pp.emailinstitucional))

      LEFT JOIN rrhh.cargos c
        ON c.idcargo = e.idcargo

      LEFT JOIN rrhh.dependencias d
        ON d.iddependencia =
           c.iddependencia

      WHERE UPPER(TRIM(es.nomestado)) =
            'APROBADO'

        AND pp.fecsolicitud =
            CURRENT_DATE

      ORDER BY
        pp.fecsolicitud ASC,
        empleado ASC
      `,
    );

    return {
      status: 'OK',
      solicitudesAgente: rows,
    };
  }

  // ============================================================
  // REGISTRAR HORA DE SALIDA
  // ============================================================

  async registrarHoraSalida(idPermiso: string, horaSalida: string, emailAgente: string) {
    const rows = await this.dataSource.query(
      `
      UPDATE rrhh.permisos_personales

      SET
        horsalida = $2::time,

        guardiaturno = $3,

        actualizadoen = CURRENT_DATE,

        actualizadopor = $3

      WHERE idpermisopersonal =
            $1::uuid

        AND horsalida IS NULL

        AND horretorno IS NULL

      RETURNING
        idpermisopersonal,
        horsalida
      `,
      [idPermiso, horaSalida, emailAgente],
    );

    if (!rows?.length) {
      throw new BadRequestException(
        'No se pudo registrar la salida. Puede que ya haya sido registrada.',
      );
    }

    return {
      status: 'OK',

      mensaje: 'Hora de salida registrada correctamente',

      idPermiso,

      horaSalida: rows[0].horsalida,
    };
  }

  // ============================================================
  // REGISTRAR HORA DE RETORNO
  // ============================================================

  async registrarHoraRetorno(idPermiso: string, horaRetorno: string, emailAgente: string) {
    return this.dataSource.transaction(async (manager) => {
      const permisos = await manager.query(
        `
          SELECT
            idpermisopersonal,

            emailinstitucional,

            horsolicitadas,

            horsalida,

            horretorno

          FROM rrhh.permisos_personales

          WHERE idpermisopersonal =
                $1::uuid

          FOR UPDATE
          `,
        [idPermiso],
      );

      const permiso = permisos?.[0];

      if (!permiso) {
        throw new NotFoundException('Permiso personal no encontrado');
      }

      if (!permiso.horsalida) {
        throw new BadRequestException('Debe registrar primero la hora de salida');
      }

      if (permiso.horretorno) {
        throw new BadRequestException('La hora de retorno ya fue registrada');
      }

      const calculo = await manager.query(
        `
            SELECT

              GREATEST(
                EXTRACT(
                  EPOCH FROM (
                    $1::time -
                    $2::time
                  )
                ) / 60,
                0
              )::integer AS
                minutos_reales,

              (
                EXTRACT(
                  EPOCH FROM $3::time
                ) / 60
              )::integer AS
                minutos_solicitados
            `,
        [horaRetorno, permiso.horsalida, permiso.horsolicitadas],
      );

      const minutosReales = Number(calculo[0]?.minutos_reales ?? 0);

      const minutosSolicitados = Number(calculo[0]?.minutos_solicitados ?? 0);

      if (minutosReales <= 0) {
        throw new BadRequestException('La hora de retorno debe ser posterior a la hora de salida');
      }

      const minutosADevolver = Math.max(0, minutosSolicitados - minutosReales);

      await manager.query(
        `
          UPDATE rrhh.permisos_personales

          SET
            horretorno = $2::time,

            guardiaturno = $3,

            actualizadoen = CURRENT_DATE,

            actualizadopor = $3

          WHERE idpermisopersonal =
                $1::uuid
          `,
        [idPermiso, horaRetorno, emailAgente],
      );

      if (minutosADevolver > 0) {
        await manager.query(
          `
            UPDATE rrhh.horas_disponibles

            SET
              hordisponibles =
                hordisponibles +
                ($2 || ' minutes')::interval,

              actualizadoen =
                CURRENT_DATE,

              actualizadopor =
                $3

            WHERE LOWER(
                    TRIM(
                      emailinstitucional
                    )
                  ) =
                  LOWER(TRIM($1))
            `,
          [permiso.emailinstitucional, minutosADevolver, emailAgente],
        );
      }

      return {
        status: 'OK',

        mensaje: 'Hora de retorno registrada correctamente',

        idPermiso,

        minutosSolicitados,

        minutosReales,

        minutosDevueltos: minutosADevolver,
      };
    });
  }
}
