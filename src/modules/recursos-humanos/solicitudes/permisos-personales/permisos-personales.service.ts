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
import { NotificacionesService } from './../../notificaciones/notificaciones.service';
import { RegistrarPermisoManualDto } from './dto/registrar-permiso-manual.dto';
import { RegistrarJustificacionLlegadaTardiaDto } from './dto/registrar-justificacion-llegada-tardia.dto';

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
    private readonly notificacionesService: NotificacionesService,
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

      // ============================================================
      // OBTENER ID DEL PERMISO CREADO
      // ============================================================

      const permisoCreado = await this.dataSource.query(
        `
      SELECT
        pp.idpermisopersonal,
        pp.emailinstitucional,
        pp.fecsolicitud,
        pp.horsolicitadas,
        pp.motivo,
        e.idsupinmediato
      FROM rrhh.permisos_personales pp

      INNER JOIN rrhh.empleados e
        ON LOWER(TRIM(e.emailinstitucional)) =
           LOWER(TRIM(pp.emailinstitucional))

      WHERE LOWER(TRIM(pp.emailinstitucional)) =
            LOWER(TRIM($1))

      ORDER BY pp.fecsolicitud DESC

      LIMIT 1
      `,
        [email],
      );
      const permiso = permisoCreado?.[0];
      // ============================================================
      // CREAR NOTIFICACIÓN PARA EL JEFE INMEDIATO
      // ============================================================

      if (permiso?.idsupinmediato) {
        try {
          const jefe = await this.dataSource.query(
            `
      SELECT
        emailinstitucional
      FROM rrhh.empleados
      WHERE numidentidad = $1
      LIMIT 1
      `,
            [permiso.idsupinmediato],
          );

          const emailJefe = jefe?.[0]?.emailinstitucional;

          if (emailJefe) {
            await this.notificacionesService.crear(
              await this.obtenerIdUsuarioPorEmail(emailJefe),
              'Nueva solicitud de permiso personal',
              `El empleado ${email} ha registrado una nueva solicitud de permiso personal para el día ${dto.fecha}.`,
              'PERMISO_PERSONAL',
              permiso.idpermisopersonal,
            );
          } else {
            this.logger.warn(`No se encontró correo del jefe inmediato para ${email}`);
          }
        } catch (error) {
          this.logger.warn(
            `El permiso personal ${permiso.idpermisopersonal} fue creado, ` +
              `pero no se pudo crear la notificación al jefe: ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
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

      if (permiso.nomestado !== 'EN PROCESO' && permiso.nomestado !== 'APROBADO') {
        throw new BadRequestException(
          'Solo se pueden anular permisos que estén en proceso o aprobados',
        );
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

  /**
   * Disponibilidad para el formulario de permisos manuales.
   * Valida que el correo corresponda a un empleado activo y calcula
   * el máximo que puede solicitar considerando saldo, límite diario y mensual.
   */
  async consultarDisponibilidadManual(email: string, fecha: string) {
    const emailEmpleado = email?.trim().toLowerCase();

    if (!emailEmpleado) {
      throw new BadRequestException('Debe seleccionar un empleado');
    }

    const empleados = await this.dataSource.query(
      `
      SELECT emailinstitucional
      FROM rrhh.empleados
      WHERE LOWER(TRIM(emailinstitucional)) = LOWER(TRIM($1))
        AND actlaboralmente = TRUE
      LIMIT 1
      `,
      [emailEmpleado],
    );

    if (!empleados.length) {
      throw new NotFoundException('El empleado seleccionado no existe o está inactivo');
    }

    const disponibilidad = await this.consultarDisponibilidad(emailEmpleado, fecha);

    const partesHora = String(disponibilidad.horasDisponibles ?? '00:00:00')
      .split(':')
      .map(Number);
    const minutosSaldo = Math.max(0, (partesHora[0] ?? 0) * 60 + (partesHora[1] ?? 0));

    const disponibleSolicitarMinutos = Math.max(
      0,
      Math.min(
        minutosSaldo,
        disponibilidad.disponibleDiaMinutos,
        disponibilidad.disponibleMesMinutos,
      ),
    );

    return {
      ...disponibilidad,
      horasDisponiblesMinutos: minutosSaldo,
      disponibleSolicitarMinutos,
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
  private async obtenerIdUsuarioPorEmail(email: string): Promise<string> {
    const usuarios = await this.dataSource.query(
      `
    SELECT
      idusuario
    FROM core.usuarios
    WHERE LOWER(TRIM(emailinstitucional)) =
          LOWER(TRIM($1))
    LIMIT 1
    `,
      [email],
    );
    const idUsuario = usuarios?.[0]?.idusuario;
    if (!idUsuario) {
      throw new NotFoundException(`No se encontró el usuario correspondiente al correo ${email}`);
    }
    return idUsuario;
  }

  async registrarPermisoManual(
    dto: RegistrarPermisoManualDto,
    emailResponsable: string,
  ): Promise<ResultadoPermisoPersonal> {
    return this.dataSource.transaction(async (manager) => {
      const emailEmpleado = dto.emailEmpleado.trim().toLowerCase();
      const emailAuditoria = emailResponsable.trim().toLowerCase();
      const horas = dto.horas.length === 5 ? `${dto.horas}:00` : dto.horas;
      const horaSalida = dto.horaSalida?.trim()
        ? dto.horaSalida.length === 5
          ? `${dto.horaSalida}:00`
          : dto.horaSalida
        : null;
      const horaRegreso = dto.horaRegreso?.trim()
        ? dto.horaRegreso.length === 5
          ? `${dto.horaRegreso}:00`
          : dto.horaRegreso
        : null;
      const observacion = dto.observacion?.trim() || null;

      // 1. Validar las horas autorizadas.
      const resultadoMinutos = await manager.query(
        `
      SELECT EXTRACT(EPOCH FROM $1::time) / 60 AS minutos
      `,
        [horas],
      );

      const minutosSolicitados = Number(resultadoMinutos[0]?.minutos ?? 0);

      if (
        !Number.isFinite(minutosSolicitados) ||
        minutosSolicitados <= 0 ||
        minutosSolicitados > 180
      ) {
        throw new BadRequestException('Las horas deben ser mayores que cero y no superar 3 horas');
      }

      // 2. Evitar registros simultáneos del mismo empleado y mes.
      await manager.query(
        `
      SELECT pg_advisory_xact_lock(
        hashtext(
          LOWER(TRIM($1)) || '-' ||
          TO_CHAR($2::date, 'YYYY-MM')
        )
      )
      `,
        [emailEmpleado, dto.fecha],
      );

      // 3. Verificar que el empleado exista y esté activo.
      const empleados = await manager.query(
        `
      SELECT emailinstitucional
      FROM rrhh.empleados
      WHERE LOWER(TRIM(emailinstitucional)) = LOWER(TRIM($1))
        AND actlaboralmente = TRUE
      LIMIT 1
      `,
        [emailEmpleado],
      );

      if (!empleados.length) {
        throw new NotFoundException(
          'No se encontró un empleado activo con ese correo institucional',
        );
      }

      // 4. Obtener el tipo de permiso personal.
      const tipos = await manager.query(
        `
      SELECT idtiposolicitud
      FROM rrhh.tipos_solicitudes_empleados
      WHERE UPPER(TRIM(nomtipo)) = 'PERMISO PERSONAL'
      LIMIT 1
      `,
      );

      // 5. Obtener el estado APROBADO.
      const estados = await manager.query(
        `
      SELECT idestadosolicitud
      FROM rrhh.estados_solicitudes
      WHERE UPPER(TRIM(nomestado)) = 'APROBADO'
      LIMIT 1
      `,
      );

      if (!tipos.length || !estados.length) {
        throw new InternalServerErrorException(
          'No se encontró el tipo PERMISO PERSONAL o el estado APROBADO',
        );
      }

      // 6. Bloquear y obtener el saldo individual del empleado.
      const saldos = await manager.query(
        `
      SELECT
        idhorasdisponible,
        COALESCE(
          EXTRACT(EPOCH FROM hordisponibles) / 60,
          0
        )::integer AS minutos_saldo,
        COALESCE(hordisponibles::text, '00:00:00') AS hordisponibles
      FROM rrhh.horas_disponibles
      WHERE LOWER(TRIM(emailinstitucional)) = LOWER(TRIM($1))
      LIMIT 1
      FOR UPDATE
      `,
        [emailEmpleado],
      );

      if (!saldos.length) {
        throw new NotFoundException('El empleado no tiene registro de horas disponibles');
      }

      const idHorasDisponibles = saldos[0].idhorasdisponible;
      const minutosSaldo = Number(saldos[0].minutos_saldo ?? 0);

      if (minutosSaldo <= 0) {
        throw new BadRequestException(
          'El empleado no tiene horas disponibles para solicitar un permiso personal',
        );
      }

      if (minutosSolicitados > minutosSaldo) {
        const horasDisponibles = saldos[0].hordisponibles ?? '00:00:00';
        throw new BadRequestException(
          `El empleado solo tiene ${horasDisponibles} disponibles. Reduzca las horas solicitadas.`,
        );
      }

      // 7. Calcular el consumo diario y mensual existente.
      const consumos = await manager.query(
        `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN UPPER(TRIM(es.nomestado)) IN ('RECHAZADO', 'ANULADO')
                THEN 0
              WHEN pp.horsalida IS NOT NULL
                   AND pp.horretorno IS NOT NULL
                THEN GREATEST(
                  EXTRACT(
                    EPOCH FROM (pp.horretorno - pp.horsalida)
                  ) / 60,
                  0
                )
              ELSE EXTRACT(EPOCH FROM pp.horsolicitadas) / 60
            END
          ) FILTER (WHERE pp.fecsolicitud = $2::date),
          0
        )::integer AS consumido_dia,

        COALESCE(
          SUM(
            CASE
              WHEN UPPER(TRIM(es.nomestado)) IN ('RECHAZADO', 'ANULADO')
                THEN 0
              WHEN pp.horsalida IS NOT NULL
                   AND pp.horretorno IS NOT NULL
                THEN GREATEST(
                  EXTRACT(
                    EPOCH FROM (pp.horretorno - pp.horsalida)
                  ) / 60,
                  0
                )
              ELSE EXTRACT(EPOCH FROM pp.horsolicitadas) / 60
            END
          ),
          0
        )::integer AS consumido_mes

      FROM rrhh.permisos_personales pp
      INNER JOIN rrhh.estados_solicitudes es
        ON es.idestadosolicitud = pp.idestadosolicitud
      WHERE LOWER(TRIM(pp.emailinstitucional)) = LOWER(TRIM($1))
        AND EXTRACT(YEAR FROM pp.fecsolicitud) =
            EXTRACT(YEAR FROM $2::date)
        AND EXTRACT(MONTH FROM pp.fecsolicitud) =
            EXTRACT(MONTH FROM $2::date)
        AND UPPER(TRIM(es.nomestado)) IN (
          'EN PROCESO',
          'APROBADO',
          'RECHAZADO',
          'ANULADO'
        )
      `,
        [emailEmpleado, dto.fecha],
      );
      const consumidoDia = Number(consumos[0]?.consumido_dia ?? 0);
      const consumidoMes = Number(consumos[0]?.consumido_mes ?? 0);
      // 8. Aplicar los límites existentes.
      if (consumidoDia + minutosSolicitados > 180) {
        throw new BadRequestException('El permiso supera el límite diario de 3 horas');
      }
      if (consumidoMes + minutosSolicitados > 540) {
        throw new BadRequestException('El permiso supera el límite mensual de 9 horas');
      }
      // 9. Registrar directamente como aprobado y manual.
      const permisosInsertados = await manager.query(
        `
      INSERT INTO rrhh.permisos_personales (
        idtiposolicitud,
        emailinstitucional,
        fecsolicitud,
        horsolicitadas,
        idhorasdisponibles,
        idestadosolicitud,
        motivo,
        catemergencia,
        priaprobacion,
        segaprobacion,
        motrechazo,
        tiempolimite,
        horsalida,
        horretorno,
        guardiaturno,
        creadoen,
        creadopor,
        esmanual,
        referenciadocumento,
        observacion
      )
      VALUES (
        $1::uuid,
        $2,
        $3::date,
        $4::time,
        $5,
        $6::uuid,
        $7,
        $8,
        NULL,
        NULL,
        NULL,
        NULL,
        $11::time,
        $12::time,
        NULL,
        CURRENT_DATE,
        $9,
        TRUE,
        $10,
        $13
      )
      RETURNING idpermisopersonal
      `,
        [
          tipos[0].idtiposolicitud,
          emailEmpleado,
          dto.fecha,
          horas,
          idHorasDisponibles,
          estados[0].idestadosolicitud,
          dto.motivo.trim(),
          dto.emergencia ?? false,
          emailAuditoria,
          dto.referenciaDocumento?.trim() || null,
          horaSalida,
          horaRegreso,
          observacion,
        ],
      );

      // 10. Descontar solo las horas solicitadas del saldo individual.
      // La fila ya está bloqueada con FOR UPDATE dentro de esta transacción.
      await manager.query(
        `
      UPDATE rrhh.horas_disponibles
      SET
        hordisponibles =
          hordisponibles - ($1::text || ' minutes')::interval,
        actualizadoen = CURRENT_DATE,
        actualizadopor = $2
      WHERE idhorasdisponible = $3
      `,
        [String(minutosSolicitados), emailAuditoria, idHorasDisponibles],
      );
      const saldoRestante = Math.max(0, minutosSaldo - minutosSolicitados);
      const minutosRestantesMes = Math.max(0, 540 - consumidoMes - minutosSolicitados);
      return {
        status: 'OK',
        message: 'Permiso personal manual registrado como aprobado',
        idPermiso: permisosInsertados[0].idpermisopersonal,
        emailEmpleado,
        fecha: dto.fecha,
        horas,
        esmanual: true,
        referenciaDocumento: dto.referenciaDocumento?.trim() || null,
        horaSalida,
        horaRegreso,
        observacion,
        minutosSolicitados,
        disponibleDiaMinutos: 180 - consumidoDia - minutosSolicitados,
        disponibleMesMinutos: minutosRestantesMes,
        horasDisponiblesMinutos: saldoRestante,
      };
    });
  }
  async consultarReporteManual(fechaInicio: string, fechaFinal: string) {
    this.validarRangoReporte(fechaInicio, fechaFinal);
    const rows = await this.dataSource.query(
      `
      SELECT
        pp.idpermisopersonal AS "idPermiso",
        pp.emailinstitucional AS "emailInstitucional",
        pp.fecsolicitud AS fecha,
        pp.horsolicitadas::text AS horas,
        pp.motivo AS motivo,
        pp.catemergencia AS emergencia,
        pp.horsalida::text AS "horaSalida",
        pp.horretorno::text AS "horaRegreso",
        pp.observacion AS observacion,
        pp.referenciadocumento AS "referenciaDocumento",
        UPPER(TRIM(es.nomestado)) AS estado,
        CONCAT_WS(
          ' ',
          e.prinombre,
          e.segnombre,
          e.priapellido,
          e.segapellido
        ) AS empleado,
        pp.creadoen AS "fechaRegistro",
        pp.creadopor AS "registradoPor"
      FROM rrhh.permisos_personales pp
      INNER JOIN rrhh.estados_solicitudes es
        ON es.idestadosolicitud = pp.idestadosolicitud
      LEFT JOIN rrhh.empleados e
        ON LOWER(TRIM(e.emailinstitucional)) =
           LOWER(TRIM(pp.emailinstitucional))
      WHERE pp.esmanual = TRUE
        AND pp.fecsolicitud >= $1::date
        AND pp.fecsolicitud < ($2::date + INTERVAL '1 day')
      ORDER BY pp.fecsolicitud DESC, empleado ASC
    `,
      [fechaInicio, fechaFinal],
    );

    return {
      status: 'OK',
      total: rows.length,
      data: rows,
    };
  }
  private validarRangoReporte(fechaInicio: string, fechaFinal: string) {
    const formatoFecha = /^\d{4}-\d{2}-\d{2}$/;
    if (
      !formatoFecha.test(fechaInicio) ||
      !formatoFecha.test(fechaFinal) ||
      Number.isNaN(Date.parse(`${fechaInicio}T00:00:00Z`)) ||
      Number.isNaN(Date.parse(`${fechaFinal}T00:00:00Z`))
    ) {
      throw new BadRequestException('Las fechas deben tener el formato YYYY-MM-DD');
    }
    if (fechaInicio > fechaFinal) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la fecha final');
    }
  }
  async buscarEmpleadosActivos(termino: string) {
    const busqueda = termino?.trim();
    if (!busqueda || busqueda.length < 2) {
      return [];
    }
    const empleados = await this.dataSource.query(
      `
      SELECT
        e.emailinstitucional AS "emailInstitucional",
        e.prinombre AS "priNombre",
        e.segnombre AS "segNombre",
        e.priapellido AS "priApellido",
        e.segapellido AS "segApellido"
      FROM rrhh.empleados e
      WHERE e.actlaboralmente = TRUE
        AND (
          LOWER(
            CONCAT_WS(
              ' ',
              e.prinombre,
              e.segnombre,
              e.priapellido,
              e.segapellido
            )
          ) LIKE LOWER($1)
          OR LOWER(e.emailinstitucional) LIKE LOWER($1)
        )
      ORDER BY e.priapellido, e.prinombre
      LIMIT 10
    `,
      [`%${busqueda}%`],
    );

    return empleados;
  }

  // ============================================================
  // REGISTRAR JUSTIFICACIÓN DE LLEGADA TARDÍA
  // ============================================================

  async registrarJustificacionLlegadaTardia(
    dto: RegistrarJustificacionLlegadaTardiaDto,
    emailResponsable: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const emailEmpleado = dto.emailEmpleado.trim().toLowerCase();
      const emailAuditoria = emailResponsable.trim().toLowerCase();
      const fecha = dto.fechaLlegada;
      const horaLlegada =
        dto.horaLlegadaReal.length === 5 ? `${dto.horaLlegadaReal}:00` : dto.horaLlegadaReal;
      const horaSalida = dto.horaSalida?.trim()
        ? dto.horaSalida.length === 5
          ? `${dto.horaSalida}:00`
          : dto.horaSalida
        : null;
      const horaRegreso = dto.horaRegreso?.trim()
        ? dto.horaRegreso.length === 5
          ? `${dto.horaRegreso}:00`
          : dto.horaRegreso
        : null;
      const observacion = dto.observacion?.trim() || null;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new BadRequestException('La fecha debe tener el formato YYYY-MM-DD');
      }

      if (!dto.motivo?.trim()) {
        throw new BadRequestException('Debe indicar el motivo de la llegada tardía');
      }

      // La hora de retraso se calcula en el backend.
      const calculo = await manager.query(
        `
        SELECT
          CASE
            WHEN $1::time > TIME '08:00:00'
            THEN EXTRACT(
              EPOCH FROM ($1::time - TIME '08:00:00')
            ) / 60
            ELSE 0
          END::integer AS minutos_retraso
        `,
        [horaLlegada],
      );

      const minutosRetraso = Number(calculo[0]?.minutos_retraso ?? 0);

      if (minutosRetraso <= 0) {
        throw new BadRequestException(
          'Solo se puede registrar una llegada posterior a las 8:00 a. m.',
        );
      }

      // Evitar registros simultáneos para el mismo empleado y fecha.
      await manager.query(
        `
        SELECT pg_advisory_xact_lock(
          hashtext(
            LOWER(TRIM($1)) || '-' ||
            TO_CHAR($2::date, 'YYYY-MM-DD')
          )
        )
        `,
        [emailEmpleado, fecha],
      );

      // Verificar que el empleado exista y esté activo.
      const empleados = await manager.query(
        `
        SELECT emailinstitucional
        FROM rrhh.empleados
        WHERE LOWER(TRIM(emailinstitucional)) = $1
          AND actlaboralmente = TRUE
        LIMIT 1
        `,
        [emailEmpleado],
      );

      if (!empleados.length) {
        throw new NotFoundException(
          'No se encontró un empleado activo con ese correo institucional',
        );
      }

      // Impedir dos justificaciones aprobadas para la misma fecha.
      const existentes = await manager.query(
        `
        SELECT idjustificacion
        FROM rrhh.justificaciones_llegadas_tardias
        WHERE LOWER(TRIM(emailinstitucional)) = $1
          AND fecha_llegada = $2::date
          AND estado = 'APROBADO'
        LIMIT 1
        `,
        [emailEmpleado, fecha],
      );

      if (existentes.length) {
        throw new BadRequestException(
          'Ya existe una justificación de llegada tardía aprobada para ese empleado y fecha',
        );
      }

      // Bloquear el saldo para evitar descuentos simultáneos.
      const saldos = await manager.query(
        `
        SELECT
          idhorasdisponible,
          COALESCE(
            EXTRACT(EPOCH FROM hordisponibles) / 60,
            0
          )::integer AS minutos_saldo,
          COALESCE(hordisponibles::text, '00:00:00')
            AS hordisponibles
        FROM rrhh.horas_disponibles
        WHERE LOWER(TRIM(emailinstitucional)) = $1
        LIMIT 1
        FOR UPDATE
        `,
        [emailEmpleado],
      );

      if (!saldos.length) {
        throw new NotFoundException('El empleado no tiene registro de horas disponibles');
      }

      const saldo = saldos[0];
      const idHorasDisponibles = saldo.idhorasdisponible;
      const minutosSaldo = Number(saldo.minutos_saldo ?? 0);

      if (minutosRetraso > minutosSaldo) {
        throw new BadRequestException(
          `El retraso es de ${minutosRetraso} minutos, pero el empleado solo tiene ${minutosSaldo} minutos disponibles`,
        );
      }

      // Guardar la justificación en su tabla independiente.
      const insertados = await manager.query(
        `
        INSERT INTO rrhh.justificaciones_llegadas_tardias (
          idhorasdisponible,
          emailinstitucional,
          fecha_llegada,
          hora_entrada_establecida,
          hora_llegada_real,
          minutos_retraso,
          motivo,
          referenciadocumento,
          estado,
          minutos_descontados,
          creadoen,
          creadopor,
          hora_salida,
          hora_regreso,
          observacion
        )
        VALUES (
          $1,
          $2,
          $3::date,
          TIME '08:00:00',
          $4::time,
          $5,
          $6,
          $7,
          'APROBADO',
          $5,
          CURRENT_DATE,
          $8,
          $9::time,
          $10::time,
          $11
        )
        RETURNING
          idjustificacion AS "idJustificacion",
          emailinstitucional AS "emailInstitucional",
          fecha_llegada AS "fechaLlegada",
          hora_entrada_establecida::text AS "horaEntradaEstablecida",
          hora_llegada_real::text AS "horaLlegadaReal",
          minutos_retraso AS "minutosRetraso",
          motivo,
          referenciadocumento AS "referenciaDocumento",
          hora_salida::text AS "horaSalida",
          hora_regreso::text AS "horaRegreso",
          observacion,
          estado,
          minutos_descontados AS "minutosDescontados"
        `,
        [
          idHorasDisponibles,
          emailEmpleado,
          fecha,
          horaLlegada,
          minutosRetraso,
          dto.motivo.trim(),
          dto.referenciaDocumento?.trim() || null,
          emailAuditoria,
          horaSalida,
          horaRegreso,
          observacion,
        ],
      );

      // Descontar exactamente los minutos calculados.
      await manager.query(
        `
        UPDATE rrhh.horas_disponibles
        SET
          hordisponibles =
            hordisponibles - ($1::text || ' minutes')::interval,
          actualizadoen = CURRENT_DATE,
          actualizadopor = $2
        WHERE idhorasdisponible = $3
        `,
        [String(minutosRetraso), emailAuditoria, idHorasDisponibles],
      );

      return {
        status: 'OK',
        message: 'Llegada tardía registrada y aprobada correctamente',
        data: insertados[0],
        minutosDescontados: minutosRetraso,
        saldoRestanteMinutos: minutosSaldo - minutosRetraso,
      };
    });
  }

  // ============================================================
  // CONSULTAR HISTORIAL DE LLEGADAS TARDÍAS
  // ============================================================

  async consultarReporteLlegadasTardias(fechaInicio: string, fechaFinal: string) {
    this.validarRangoReporte(fechaInicio, fechaFinal);

    const rows = await this.dataSource.query(
      `
      SELECT
        j.idjustificacion AS "idJustificacion",
        j.emailinstitucional AS "emailInstitucional",
        j.fecha_llegada AS "fechaLlegada",
        j.hora_entrada_establecida::text
          AS "horaEntradaEstablecida",
        j.hora_llegada_real::text AS "horaLlegadaReal",
        j.minutos_retraso AS "minutosRetraso",
        j.motivo,
        j.referenciadocumento AS "referenciaDocumento",
        j.hora_salida::text AS "horaSalida",
        j.hora_regreso::text AS "horaRegreso",
        j.observacion,
        j.estado,
        j.minutos_descontados AS "minutosDescontados",
        j.creadoen AS "fechaRegistro",
        j.creadopor AS "registradoPor",
        j.actualizadoen AS "fechaActualizacion",
        j.actualizadopor AS "actualizadoPor",
        CONCAT_WS(
          ' ',
          e.prinombre,
          e.segnombre,
          e.priapellido,
          e.segapellido
        ) AS empleado
      FROM rrhh.justificaciones_llegadas_tardias j
      LEFT JOIN rrhh.empleados e
        ON LOWER(TRIM(e.emailinstitucional)) =
           LOWER(TRIM(j.emailinstitucional))
      WHERE j.fecha_llegada >= $1::date
        AND j.fecha_llegada < ($2::date + INTERVAL '1 day')
      ORDER BY j.fecha_llegada DESC, empleado ASC
      `,
      [fechaInicio, fechaFinal],
    );

    return {
      status: 'OK',
      total: rows.length,
      data: rows,
    };
  }

  // ============================================================
  // ANULAR JUSTIFICACIÓN Y DEVOLVER EL SALDO
  // ============================================================

  async anularJustificacionLlegadaTardia(idJustificacion: string, emailResponsable: string) {
    return this.dataSource.transaction(async (manager) => {
      const emailAuditoria = emailResponsable.trim().toLowerCase();

      const registros = await manager.query(
        `
        SELECT
          idjustificacion,
          idhorasdisponible,
          emailinstitucional,
          minutos_descontados,
          estado
        FROM rrhh.justificaciones_llegadas_tardias
        WHERE idjustificacion = $1::uuid
        FOR UPDATE
        `,
        [idJustificacion],
      );

      const registro = registros[0];

      if (!registro) {
        throw new NotFoundException('No se encontró la justificación de llegada tardía');
      }

      if (registro.estado !== 'APROBADO') {
        throw new BadRequestException('La justificación ya fue anulada o no está aprobada');
      }

      const minutosDevolver = Number(registro.minutos_descontados ?? 0);

      // Bloquear el saldo antes de restaurarlo.
      const saldos = await manager.query(
        `
        SELECT idhorasdisponible
        FROM rrhh.horas_disponibles
        WHERE idhorasdisponible = $1
        FOR UPDATE
        `,
        [registro.idhorasdisponible],
      );

      if (!saldos.length) {
        throw new NotFoundException(
          'No se encontró el saldo de horas que corresponde a la justificación',
        );
      }

      if (minutosDevolver > 0) {
        await manager.query(
          `
          UPDATE rrhh.horas_disponibles
          SET
            hordisponibles =
              hordisponibles + ($1::text || ' minutes')::interval,
            actualizadoen = CURRENT_DATE,
            actualizadopor = $2
          WHERE idhorasdisponible = $3
          `,
          [String(minutosDevolver), emailAuditoria, registro.idhorasdisponible],
        );
      }

      // Se cambia el estado dentro de la misma transacción.
      // Una segunda anulación no podrá devolver el saldo otra vez.
      await manager.query(
        `
        UPDATE rrhh.justificaciones_llegadas_tardias
        SET
          estado = 'ANULADO',
          actualizadoen = CURRENT_DATE,
          actualizadopor = $2
        WHERE idjustificacion = $1::uuid
        `,
        [idJustificacion, emailAuditoria],
      );

      return {
        status: 'OK',
        message: 'Justificación anulada correctamente',
        idJustificacion,
        minutosDevueltos: minutosDevolver,
      };
    });
  }
}
