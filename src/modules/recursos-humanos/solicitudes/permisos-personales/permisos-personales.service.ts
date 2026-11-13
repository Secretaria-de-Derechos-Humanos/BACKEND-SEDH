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
import { unlink } from 'fs/promises';
import { relative, sep } from 'path';
import { Cron } from '@nestjs/schedule';

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

  private calcularFechaLimiteComprobante(fechaRegistro: string): string {
    const fecha = new Date(`${fechaRegistro}T12:00:00`);
    let diasHabiles = 0;
    while (diasHabiles < 3) {
      fecha.setDate(fecha.getDate() + 1);
      const diaSemana = fecha.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasHabiles++;
      }
    }
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  @Cron('0 10 0 * * 1-5', {
    timeZone: 'America/Tegucigalpa',
  })
  async vencerComprobantesPendientes(): Promise<void> {
    try {
      const resultado = await this.dataSource.query(`
      UPDATE rrhh.permisos_personales
      SET estado_comprobante = 'VENCIDO'
      WHERE catemergencia = TRUE
        AND estado_comprobante = 'PENDIENTE'
        AND fecha_limite_comprobante IS NOT NULL
        AND (
          CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa'
        )::date > fecha_limite_comprobante
      RETURNING idpermisopersonal
    `);

      if (resultado.length > 0) {
        this.logger.log(`Comprobantes médicos vencidos: ${resultado.length}`);
      }
    } catch (error) {
      this.logger.error(
        'Error al actualizar comprobantes médicos vencidos',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
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
    archivo?: Express.Multer.File,
  ): Promise<ResultadoPermisoPersonal> {
    let transaccionConfirmada = false;

    try {
      // Normalizar explícitamente el valor de emergencia.
      const emergencia = String(dto.emergencia).trim().toLowerCase() === 'true';
      // ============================================================
      // REGISTRAR PERMISO Y GUARDAR REFERENCIA DEL ARCHIVO
      // ============================================================

      const { resultado, permiso } = await this.dataSource.transaction(async (manager) => {
        const rows = (await manager.query(
          `
          SELECT rrhh.insertar_permiso_personal(
            $1::character varying,
            $2::date,
            $3::time without time zone,
            $4::character varying,
            $5::boolean
          ) AS resultado
          `,
          [email, dto.fecha, dto.horas, dto.motivo.trim(), emergencia],
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

        // Obtener el ID exacto devuelto por la función SQL.
        const idPermiso = resultado.idpermiso;

        if (typeof idPermiso !== 'string' || !idPermiso.trim()) {
          throw new InternalServerErrorException('La función no devolvió el ID del permiso creado');
        }

        // Guardar la ruta del comprobante en el permiso correspondiente.

        // ============================================================
        // CONTROL DEL COMPROBANTE MÉDICO
        // ============================================================

        // Obtener la fecha actual de Honduras desde PostgreSQL.
        const fechaRegistroRows = await manager.query(`
          SELECT
            (CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa')::date::text
              AS fecha_registro
        `);

        const fechaRegistro = fechaRegistroRows[0]?.fecha_registro;

        if (!fechaRegistro) {
          throw new InternalServerErrorException(
            'No se pudo obtener la fecha de registro del permiso',
          );
        }

        // Calcular el estado y el plazo únicamente para emergencias.
        const estadoComprobante = emergencia ? (archivo ? 'ENTREGADO' : 'PENDIENTE') : null;

        const fechaLimite = emergencia ? this.calcularFechaLimiteComprobante(fechaRegistro) : null;

        const fechaEntrega = emergencia && archivo ? fechaRegistro : null;

        // Guardar la ruta si el empleado adjuntó el comprobante.
        const rutaRelativa = archivo
          ? relative(process.cwd(), archivo.path).split(sep).join('/')
          : null;

        const actualizacion = await manager.query(
          `
          UPDATE rrhh.permisos_personales
          SET
            referenciadocumento = COALESCE(
              $1::character varying,
              referenciadocumento
            ),
            estado_comprobante = $2::character varying,
            fecha_limite_comprobante = $3::date,
            fecha_entrega_comprobante = $4::date
          WHERE idpermisopersonal = $5::uuid
          RETURNING idpermisopersonal
          `,
          [rutaRelativa, estadoComprobante, fechaLimite, fechaEntrega, idPermiso],
        );

        if (!actualizacion?.length) {
          throw new InternalServerErrorException(
            'No se pudo actualizar el comprobante del permiso personal',
          );
        }

        // Consultar el permiso recién creado por su ID.
        const permisoCreado = await manager.query(
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
          WHERE pp.idpermisopersonal = $1::uuid
          LIMIT 1
          `,
          [idPermiso],
        );

        return {
          resultado,
          permiso: permisoCreado?.[0],
        };
      });

      transaccionConfirmada = true;

      // ============================================================
      // NOTIFICACIONES PARA JEFE INMEDIATO Y SUBGERENTES RRHH
      // ============================================================

      const destinatarios = new Set<string>();

      // 1. Obtener el usuario del jefe inmediato.
      if (permiso?.idsupinmediato) {
        try {
          const jefe = await this.dataSource.query(
            `
              SELECT emailinstitucional
              FROM rrhh.empleados
              WHERE TRIM(numidentidad) = TRIM($1)
              LIMIT 1
            `,
            [permiso.idsupinmediato],
          );

          const emailJefe = jefe?.[0]?.emailinstitucional;

          if (emailJefe) {
            const idUsuarioJefe = await this.obtenerIdUsuarioPorEmail(emailJefe);

            destinatarios.add(String(idUsuarioJefe));
          }
        } catch (error) {
          this.logger.warn(
            `No se pudo identificar al jefe inmediato: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      // 2. Agregar todos los usuarios activos con rol Subgerente RRHH.
      try {
        const idsSubgerentes = await this.obtenerIdsSubgerentesRrhh();

        idsSubgerentes.forEach((id) => destinatarios.add(String(id)));
      } catch (error) {
        this.logger.error(
          `No se pudieron obtener los subgerentes RRHH: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      // 3. Crear una notificación para cada destinatario sin duplicados.
      for (const idUsuario of destinatarios) {
        try {
          await this.notificacionesService.crear(
            idUsuario,
            'Nueva solicitud de permiso personal',
            `El empleado ${email} ha registrado una nueva solicitud de permiso personal para el día ${dto.fecha}.`,
            'PERMISO_PERSONAL',
            permiso?.idpermisopersonal ?? null,
          );

          this.logger.log(`[NOTIFICACIONES] Permiso personal notificado al usuario ${idUsuario}`);
        } catch (error) {
          this.logger.warn(
            `No se pudo notificar al usuario ${idUsuario}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      return resultado;
    } catch (error: unknown) {
      // Si falla la transacción, eliminar el archivo que se había guardado.
      if (archivo?.path && !transaccionConfirmada) {
        try {
          await unlink(archivo.path);
        } catch (errorArchivo) {
          this.logger.warn(
            `No se pudo eliminar el archivo temporal: ${
              errorArchivo instanceof Error ? errorArchivo.message : String(errorArchivo)
            }`,
          );
        }
      }

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

  async adjuntarComprobanteEmergencia(
    idPermiso: string,
    email: string,
    archivo: Express.Multer.File,
  ) {
    if (!archivo) {
      throw new BadRequestException('Debe seleccionar un comprobante médico');
    }

    let archivoGuardado = false;

    try {
      const rutaRelativa = relative(process.cwd(), archivo.path).split(sep).join('/');

      const resultado = await this.dataSource.transaction(async (manager) => {
        const permisos = await manager.query(
          `
          SELECT
            catemergencia,
            estado_comprobante,
            fecha_limite_comprobante,
            referenciadocumento,
            (CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa')::date
              AS fecha_actual
          FROM rrhh.permisos_personales
          WHERE idpermisopersonal = $1::uuid
            AND LOWER(TRIM(emailinstitucional)) = LOWER(TRIM($2))
          FOR UPDATE
          `,
          [idPermiso, email],
        );

        const permiso = permisos?.[0];

        if (!permiso) {
          throw new NotFoundException(
            'No se encontró el permiso o no pertenece al usuario autenticado',
          );
        }

        if (permiso.catemergencia !== true) {
          throw new BadRequestException('El permiso seleccionado no corresponde a una emergencia');
        }

        if (permiso.estado_comprobante !== 'PENDIENTE') {
          throw new BadRequestException('El comprobante no está pendiente de entrega');
        }

        const vencido = await manager.query(
          `
          SELECT $1::date > $2::date AS vencido
          `,
          [permiso.fecha_actual, permiso.fecha_limite_comprobante],
        );

        if (vencido[0]?.vencido) {
          throw new BadRequestException(
            'El plazo de tres días hábiles para entregar el comprobante ha vencido',
          );
        }

        const actualizado = await manager.query(
          `
          UPDATE rrhh.permisos_personales
          SET
            referenciadocumento = $1,
            estado_comprobante = 'ENTREGADO',
            fecha_entrega_comprobante = $2::date
          WHERE idpermisopersonal = $3::uuid
          RETURNING idpermisopersonal
          `,
          [rutaRelativa, permiso.fecha_actual, idPermiso],
        );

        if (!actualizado?.length) {
          throw new InternalServerErrorException('No se pudo guardar el comprobante médico');
        }

        return {
          status: 'OK',
          mensaje: 'Comprobante médico adjuntado correctamente',
          estadoComprobante: 'ENTREGADO',
          fechaEntrega: permiso.fecha_actual,
        };
      });

      archivoGuardado = true;
      return resultado;
    } finally {
      if (!archivoGuardado) {
        await unlink(archivo.path).catch(() => undefined);
      }
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
        pp.fecsolicitud,
        pp.horsolicitadas,
        pp.catemergencia,
        pp.horsalida,
        pp.horretorno,
        pp.idestadosolicitud,
        pp.priaprobacion,
        pp.segaprobacion,
        UPPER(TRIM(es.nomestado)) AS nomestado
      FROM rrhh.permisos_personales pp
      INNER JOIN rrhh.estados_solicitudes es
        ON es.idestadosolicitud = pp.idestadosolicitud
      WHERE pp.idpermisopersonal = $1::uuid
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

      // 1. Validar estado del permiso.
      if (permiso.nomestado !== 'EN PROCESO' && permiso.nomestado !== 'APROBADO') {
        throw new BadRequestException(
          'Solo se pueden anular permisos que estén en proceso o aprobados',
        );
      }

      // 2. Impedir anulación si ya tiene las dos aprobaciones.
      const tieneAprobacionJefe = Boolean(permiso.priaprobacion?.trim());

      const tieneAprobacionRRHH = Boolean(permiso.segaprobacion?.trim());

      if (tieneAprobacionJefe && tieneAprobacionRRHH) {
        throw new BadRequestException(
          'No se puede anular el permiso porque ya cuenta con las aprobaciones del jefe inmediato y Recursos Humanos',
        );
      }

      // 3. Impedir anulación si el permiso ya fue utilizado.
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

      // 4. Obtener el estado ANULADO.
      const estadosAnulado = await manager.query(
        `
      SELECT idestadosolicitud
      FROM rrhh.estados_solicitudes
      WHERE UPPER(TRIM(nomestado)) = 'ANULADO'
      LIMIT 1
      `,
      );

      if (!estadosAnulado?.length) {
        throw new InternalServerErrorException('No se encontró el estado ANULADO');
      }

      const idEstadoAnulado = estadosAnulado[0].idestadosolicitud;

      // 5. Obtener el período al que pertenece el permiso.
      const periodoResultado = await manager.query(
        `
      SELECT DATE_TRUNC(
        'month',
        $1::date
      )::date AS periodo
      `,
        [permiso.fecsolicitud],
      );

      const periodoPermiso = periodoResultado[0].periodo;

      // 6. Bloquear y consultar el saldo del empleado.
      const saldos = await manager.query(
        `
      SELECT
        idhorasdisponible,
        periodo_saldo
      FROM rrhh.horas_disponibles
      WHERE LOWER(TRIM(emailinstitucional)) =
            LOWER(TRIM($1))
      LIMIT 1
      FOR UPDATE
      `,
        [permiso.emailinstitucional],
      );

      if (!saldos.length) {
        throw new NotFoundException('No se encontró el saldo de horas del empleado');
      }

      const saldo = saldos[0];

      const mismoPeriodo =
        saldo.periodo_saldo &&
        String(saldo.periodo_saldo).slice(0, 10) === String(periodoPermiso).slice(0, 10);

      // 7. Devolver horas únicamente si corresponden al mismo mes.
      let horasDevueltas = false;

      if (
        permiso.horsolicitadas &&
        mismoPeriodo &&
        !(permiso.catemergencia === true || String(permiso.catemergencia).toLowerCase() === 'true')
      ) {
        const actualizacion = await manager.query(
          `
        UPDATE rrhh.horas_disponibles
        SET
          hordisponibles =
            hordisponibles +
            (
              $1::time - TIME '00:00:00'
            ),
          actualizadoen = CURRENT_DATE,
          actualizadopor = $2
        WHERE idhorasdisponible = $3
          AND periodo_saldo = $4::date
        RETURNING idhorasdisponible
        `,
          [permiso.horsolicitadas, email, saldo.idhorasdisponible, periodoPermiso],
        );

        if (!actualizacion.length) {
          throw new BadRequestException('No se pudo devolver el saldo al período correspondiente');
        }

        horasDevueltas = true;
      }

      // 8. Anular el permiso dentro de la misma transacción.
      await manager.query(
        `
      UPDATE rrhh.permisos_personales
      SET
        idestadosolicitud = $2::uuid,
        actualizadoen = CURRENT_DATE,
        actualizadopor = $3
      WHERE idpermisopersonal = $1::uuid
      `,
        [idPermiso, idEstadoAnulado, email],
      );

      return {
        status: 'OK',
        message: horasDevueltas
          ? 'Permiso personal anulado correctamente y horas devueltas'
          : permiso.catemergencia === true || String(permiso.catemergencia).toLowerCase() === 'true'
            ? 'Permiso de emergencia anulado correctamente. No se devolvieron horas porque no fueron descontadas'
            : 'Permiso personal anulado correctamente. No se devolvieron horas porque corresponde a otro período mensual',
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
    WITH consumo_dia AS (
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN UPPER(TRIM(es.nomestado))
                   IN ('RECHAZADO', 'ANULADO')
                THEN 0

              WHEN pp.horsalida IS NOT NULL
                   AND pp.horretorno IS NOT NULL
                THEN GREATEST(
                  EXTRACT(
                    EPOCH FROM (
                      pp.horretorno - pp.horsalida
                    )
                  ) / 60,
                  0
                )

              ELSE
                EXTRACT(
                  EPOCH FROM pp.horsolicitadas
                ) / 60
            END
          ),
          0
        ) AS minutos_consumidos
      FROM rrhh.permisos_personales pp
      INNER JOIN rrhh.estados_solicitudes es
        ON es.idestadosolicitud = pp.idestadosolicitud
      WHERE LOWER(TRIM(pp.emailinstitucional)) =
      LOWER(TRIM($1))
  AND pp.fecsolicitud = $2::date
  AND COALESCE(pp.catemergencia, FALSE) = FALSE
    )

    SELECT
      hd.hordisponibles::text AS hordisponibles,
      COALESCE(cd.minutos_consumidos, 0) AS consumidodia
    FROM consumo_dia cd
    LEFT JOIN rrhh.horas_disponibles hd
      ON LOWER(TRIM(hd.emailinstitucional)) =
         LOWER(TRIM($1))
     AND hd.periodo_saldo =
         DATE_TRUNC('month', $2::date)::date
    `,
      [email, fecha],
    )) as DisponibilidadRow[];

    const fila = rows[0];

    if (!fila?.hordisponibles) {
      throw new BadRequestException(
        'El saldo mensual del empleado no está inicializado para el período consultado',
      );
    }

    // 1. Consumo diario: únicamente permisos personales.
    const consumidoDia = Math.round(Number(fila.consumidodia ?? 0));

    const disponibleDia = Math.max(0, 180 - consumidoDia);

    // 2. Saldo compartido: permisos personales y llegadas tardías.
    const partesHora = String(fila.hordisponibles).split(':').map(Number);

    const horas = partesHora[0] ?? 0;
    const minutos = partesHora[1] ?? 0;
    const segundos = partesHora[2] ?? 0;

    const saldoMinutos = Math.max(0, Math.floor(horas * 60 + minutos + segundos / 60));

    // 3. El consumo mensual se obtiene del saldo real.
    const consumidoMes = Math.max(0, 540 - saldoMinutos);

    const disponibleMes = Math.min(540, saldoMinutos);

    return {
      fecha,
      limiteDiarioMinutos: 180,
      consumidoDiaMinutos: consumidoDia,
      disponibleDiaMinutos: disponibleDia,
      limiteMensualMinutos: 540,
      consumidoMesMinutos: consumidoMes,
      disponibleMesMinutos: disponibleMes,
      horasDisponibles: fila.hordisponibles,
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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('La fecha debe tener el formato YYYY-MM-DD');
    }

    const fechaValida = await this.dataSource.query(`SELECT $1::date = $1::text::date AS valida`, [
      fecha,
    ]);

    if (!fechaValida[0]?.valida) {
      throw new BadRequestException('La fecha indicada no es válida');
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

    const horas = partesHora[0] ?? 0;
    const minutos = partesHora[1] ?? 0;
    const segundos = partesHora[2] ?? 0;

    const minutosSaldo = Math.max(0, Math.floor(horas * 60 + minutos + segundos / 60));

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

 WHERE UPPER(TRIM(es.nomestado)) = 'APROBADO'
  AND pp.fecsolicitud >= DATE_TRUNC(
        'month',
        CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa'
      )::date
  AND pp.fecsolicitud < (
        DATE_TRUNC(
          'month',
          CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa'
        ) + INTERVAL '1 month'
      )::date
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
      // 1. Consultar y bloquear el permiso.
      const permisos = await manager.query(
        `
      SELECT
        idpermisopersonal,
        emailinstitucional,
        fecsolicitud,
        horsolicitadas,
        horsalida,
        horretorno,
        catemergencia
      FROM rrhh.permisos_personales
      WHERE idpermisopersonal = $1::uuid
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

      // 2. Calcular los minutos reales y solicitados.
      const calculo = await manager.query(
        `
      SELECT
        GREATEST(
          EXTRACT(
            EPOCH FROM (
              $1::time - $2::time
            )
          ) / 60,
          0
        )::integer AS minutos_reales,
        (
          EXTRACT(
            EPOCH FROM $3::time
          ) / 60
        )::integer AS minutos_solicitados
      `,
        [horaRetorno, permiso.horsalida, permiso.horsolicitadas],
      );

      const minutosReales = Number(calculo[0]?.minutos_reales ?? 0);

      const minutosSolicitados = Number(calculo[0]?.minutos_solicitados ?? 0);

      if (minutosReales <= 0) {
        throw new BadRequestException('La hora de retorno debe ser posterior a la hora de salida');
      }

      const minutosADevolver = Math.max(0, minutosSolicitados - minutosReales);

      // 3. Registrar la hora de retorno.
      await manager.query(
        `
      UPDATE rrhh.permisos_personales
      SET
        horretorno = $2::time,
        guardiaturno = $3,
        actualizadoen = CURRENT_DATE,
        actualizadopor = $3
      WHERE idpermisopersonal = $1::uuid
      `,
        [idPermiso, horaRetorno, emailAgente],
      );

      let minutosDevueltos = 0;

      // 4. Si hay minutos que devolver, verificar el período del saldo.
      const esEmergencia =
        permiso.catemergencia === true || String(permiso.catemergencia).toLowerCase() === 'true';

      // Las emergencias no descuentan saldo, por lo tanto,
      // tampoco deben recibir devoluciones.
      if (minutosADevolver > 0 && !esEmergencia) {
        const saldos = await manager.query(
          `
        SELECT
          idhorasdisponible,
          periodo_saldo,
          (
            periodo_saldo =
            DATE_TRUNC('month', $2::date)::date
          ) AS mismo_periodo
        FROM rrhh.horas_disponibles
        WHERE LOWER(TRIM(emailinstitucional)) =
              LOWER(TRIM($1))
        LIMIT 1
        FOR UPDATE
        `,
          [permiso.emailinstitucional, permiso.fecsolicitud],
        );

        if (!saldos.length) {
          throw new NotFoundException('No se encontró el saldo de horas del empleado');
        }

        const saldo = saldos[0];

        // 5. Devolver únicamente si corresponde al mismo mes.
        if (saldo.mismo_periodo === true) {
          const actualizacion = await manager.query(
            `
          UPDATE rrhh.horas_disponibles
          SET
            hordisponibles =
              hordisponibles +
              ($1::text || ' minutes')::interval,
            actualizadoen = CURRENT_DATE,
            actualizadopor = $2
          WHERE idhorasdisponible = $3
            AND periodo_saldo =
                DATE_TRUNC('month', $4::date)::date
          RETURNING idhorasdisponible
          `,
            [String(minutosADevolver), emailAgente, saldo.idhorasdisponible, permiso.fecsolicitud],
          );

          if (!actualizacion.length) {
            throw new BadRequestException(
              'No se pudo devolver el saldo al período correspondiente',
            );
          }

          minutosDevueltos = minutosADevolver;
        }
      }

      // 6. Respuesta.
      return {
        status: 'OK',
        mensaje: 'Hora de retorno registrada correctamente',
        idPermiso,
        minutosSolicitados,
        minutosReales,
        minutosDevueltos,
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
  private async obtenerIdsSubgerentesRrhh(): Promise<string[]> {
    const usuarios = await this.dataSource.query(
      `
      SELECT DISTINCT u.idusuario
      FROM core.usuarios u
      INNER JOIN core.usuario_roles ur
        ON ur.idusuario = u.idusuario
      WHERE ur.idrol = 3
        AND u.activo = TRUE
    `,
    );

    return usuarios.map((usuario: any) => String(usuario.idusuario));
  }

  async registrarPermisoManual(
    dto: RegistrarPermisoManualDto,
    emailResponsable: string,
  ): Promise<ResultadoPermisoPersonal> {
    return this.dataSource.transaction(async (manager) => {
      const emailEmpleado = dto.emailEmpleado.trim().toLowerCase();
      const emailAuditoria = emailResponsable.trim().toLowerCase();

      const esEmergencia = dto.emergencia ?? false;

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

      // 1. Validar fecha.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.fecha)) {
        throw new BadRequestException('La fecha debe tener el formato YYYY-MM-DD');
      }

      const periodoResultado = await manager.query(
        `
      SELECT
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa')::date AS hoy,
        DATE_TRUNC(
          'month',
          CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa'
        )::date AS periodo
      `,
      );

      const periodoActual = String(periodoResultado[0].periodo).slice(0, 10);

      const fechaResultado = await manager.query(`SELECT $1::date AS fecha`, [dto.fecha]);

      const fechaPermiso = String(fechaResultado[0].fecha).slice(0, 10);

      const siguientePeriodo = await manager.query(
        `
      SELECT (
        DATE_TRUNC('month', $1::date) + INTERVAL '1 month'
      )::date AS siguiente_periodo
      `,
        [periodoActual],
      );

      const limitePeriodo = String(siguientePeriodo[0].siguiente_periodo).slice(0, 10);

      if (fechaPermiso < periodoActual || fechaPermiso >= limitePeriodo) {
        throw new BadRequestException('El permiso debe pertenecer al mes vigente');
      }

      // 2. Validar horas.
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

      // 3. Evitar registros simultáneos del mismo empleado y mes.
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

      // 4. Verificar empleado activo.
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

      // 5. Obtener tipo de permiso personal.
      const tipos = await manager.query(
        `
      SELECT idtiposolicitud
      FROM rrhh.tipos_solicitudes_empleados
      WHERE UPPER(TRIM(nomtipo)) = 'PERMISO PERSONAL'
      LIMIT 1
      `,
      );

      // 6. Obtener estado APROBADO.
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

      // 7. Bloquear y obtener saldo mensual.
      const saldos = await manager.query(
        `
      SELECT
        idhorasdisponible,
        periodo_saldo,
        COALESCE(
          EXTRACT(EPOCH FROM hordisponibles) / 60,
          0
        )::integer AS minutos_saldo,
        COALESCE(hordisponibles::text, '00:00:00')
          AS hordisponibles
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

      const saldo = saldos[0];
      const idHorasDisponibles = saldo.idhorasdisponible;
      const minutosSaldo = Number(saldo.minutos_saldo ?? 0);

      if (
        !esEmergencia &&
        (!saldo.periodo_saldo || String(saldo.periodo_saldo).slice(0, 10) !== periodoActual)
      ) {
        throw new BadRequestException(
          'El saldo mensual del empleado no está inicializado para el período vigente',
        );
      }

      if (!esEmergencia && minutosSolicitados > minutosSaldo) {
        throw new BadRequestException(
          `El empleado solo tiene ${saldo.hordisponibles} disponibles. Reduzca las horas solicitadas.`,
        );
      }

      // 8. Calcular consumo diario, excluyendo emergencias.
      const consumos = await manager.query(
        `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN UPPER(TRIM(es.nomestado))
                   IN ('RECHAZADO', 'ANULADO')
                THEN 0

              WHEN pp.horsalida IS NOT NULL
                   AND pp.horretorno IS NOT NULL
                THEN GREATEST(
                  EXTRACT(
                    EPOCH FROM (
                      pp.horretorno - pp.horsalida
                    )
                  ) / 60,
                  0
                )

              ELSE
                EXTRACT(EPOCH FROM pp.horsolicitadas) / 60
            END
          ) FILTER (
            WHERE pp.fecsolicitud = $2::date
          ),
          0
        )::integer AS consumido_dia
      FROM rrhh.permisos_personales pp
      INNER JOIN rrhh.estados_solicitudes es
        ON es.idestadosolicitud = pp.idestadosolicitud
      WHERE LOWER(TRIM(pp.emailinstitucional)) = LOWER(TRIM($1))
        AND DATE_TRUNC('month', pp.fecsolicitud) =
            DATE_TRUNC('month', $2::date)
        AND COALESCE(pp.catemergencia, FALSE) = FALSE
      `,
        [emailEmpleado, dto.fecha],
      );

      const consumidoDia = Number(consumos[0]?.consumido_dia ?? 0);

      // 9. Consumo mensual según saldo compartido.
      const consumidoMes = esEmergencia
        ? Math.max(0, 540 - minutosSaldo)
        : Math.max(0, 540 - minutosSaldo);

      // 10. Aplicar límites solamente a permisos normales.
      if (!esEmergencia && consumidoDia + minutosSolicitados > 180) {
        throw new BadRequestException('El permiso supera el límite diario de 3 horas');
      }

      if (!esEmergencia && consumidoMes + minutosSolicitados > 540) {
        throw new BadRequestException('El permiso supera el límite mensual de 9 horas');
      }

      // 11. Registrar permiso manual como aprobado.
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
          esEmergencia,
          emailAuditoria,
          dto.referenciaDocumento?.trim() || null,
          horaSalida,
          horaRegreso,
          observacion,
        ],
      );

      // 12. Descontar saldo únicamente si NO es emergencia.
      let saldoRestante = minutosSaldo;

      if (!esEmergencia) {
        const actualizacion = await manager.query(
          `
        UPDATE rrhh.horas_disponibles
        SET
          hordisponibles =
            hordisponibles - ($1::text || ' minutes')::interval,
          actualizadoen = CURRENT_DATE,
          actualizadopor = $2
        WHERE idhorasdisponible = $3
          AND periodo_saldo = $4::date
        RETURNING
          EXTRACT(EPOCH FROM hordisponibles) / 60
            AS minutos_restantes
        `,
          [String(minutosSolicitados), emailAuditoria, idHorasDisponibles, periodoActual],
        );

        if (!actualizacion.length) {
          throw new BadRequestException('No se pudo actualizar el saldo mensual del empleado');
        }

        saldoRestante = Number(actualizacion[0].minutos_restantes);
      }

      const minutosRestantesMes = Math.max(0, saldoRestante);

      return {
        status: 'OK',
        message: esEmergencia
          ? 'Permiso personal manual de emergencia registrado como aprobado sin descontar saldo'
          : 'Permiso personal manual registrado como aprobado',
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
        disponibleDiaMinutos: esEmergencia
          ? Math.max(0, 180 - consumidoDia)
          : Math.max(0, 180 - consumidoDia - minutosSolicitados),
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
  hd.hordisponibles::text AS "horasDisponibles",
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
  d.nomdependencia AS "dependencia",
  pp.creadoen AS "fechaRegistro",
  pp.creadopor AS "registradoPor"
FROM rrhh.permisos_personales pp
INNER JOIN rrhh.estados_solicitudes es
  ON es.idestadosolicitud = pp.idestadosolicitud
LEFT JOIN rrhh.empleados e
  ON LOWER(TRIM(e.emailinstitucional)) =
     LOWER(TRIM(pp.emailinstitucional))
LEFT JOIN rrhh.cargos c
  ON c.idcargo = e.idcargo
LEFT JOIN rrhh.dependencias d
  ON d.iddependencia = c.iddependencia
  LEFT JOIN rrhh.horas_disponibles hd
  ON LOWER(TRIM(hd.emailinstitucional)) =
     LOWER(TRIM(pp.emailinstitucional))
 AND hd.periodo_saldo =
     DATE_TRUNC('month', pp.fecsolicitud)::date
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

      // 1. Validar formato de fecha.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new BadRequestException('La fecha debe tener el formato YYYY-MM-DD');
      }

      if (!dto.motivo?.trim()) {
        throw new BadRequestException('Debe indicar el motivo de la llegada tardía');
      }

      // 2. Obtener fecha y período actual de Honduras.
      const periodoResultado = await manager.query(`
      SELECT
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa')::date AS hoy,
        DATE_TRUNC(
          'month',
          CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa'
        )::date AS periodo
    `);

      const hoy = periodoResultado[0].hoy;
      const periodoActual = periodoResultado[0].periodo;

      // 3. Validar que la fecha exista y pertenezca al mes vigente.

      // 3. Validar que la llegada tardía pueda justificarse
      // hasta 3 días calendario después de haber ocurrido.
      const fechaResultado = await manager.query(
        `
    SELECT
      $1::date AS fecha,
      ($2::date - $1::date)::integer AS dias_transcurridos
  `,
        [fecha, hoy],
      );

      const diasTranscurridos = Number(fechaResultado[0]?.dias_transcurridos);

      if (
        !fechaResultado[0]?.fecha ||
        !Number.isInteger(diasTranscurridos) ||
        diasTranscurridos < 0 ||
        diasTranscurridos > 3
      ) {
        throw new BadRequestException(
          'La llegada tardía solo puede justificarse hasta 3 días calendario después de haber ocurrido. No se permiten fechas futuras.',
        );
      }

      // 4. Calcular los minutos de retraso desde las 8:00 a. m.
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

      // 5. Evitar registros simultáneos para el mismo empleado y fecha.
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

      // 6. Verificar que el empleado exista y esté activo.
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

      // 7. Impedir dos justificaciones aprobadas para la misma fecha.
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

      // 8. Bloquear y consultar el saldo mensual del empleado.
      const saldos = await manager.query(
        `
      SELECT
        idhorasdisponible,
        periodo_saldo,
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

      // 9. Verificar que el saldo pertenezca al período actual.
      if (
        !saldo.periodo_saldo ||
        String(saldo.periodo_saldo).slice(0, 10) !== String(periodoActual).slice(0, 10)
      ) {
        throw new BadRequestException(
          'El saldo mensual del empleado no está inicializado para el período vigente',
        );
      }

      // 10. Verificar que tenga minutos suficientes.
      if (minutosRetraso > minutosSaldo) {
        throw new BadRequestException(
          `El retraso es de ${minutosRetraso} minutos, pero el empleado solo tiene ${minutosSaldo} minutos disponibles`,
        );
      }

      // 11. Guardar la justificación en su tabla independiente.
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

      // 12. Descontar los minutos del saldo del período vigente.
      const actualizacion = await manager.query(
        `
      UPDATE rrhh.horas_disponibles
      SET
        hordisponibles =
          hordisponibles - ($1::text || ' minutes')::interval,
        actualizadoen = CURRENT_DATE,
        actualizadopor = $2
      WHERE idhorasdisponible = $3
        AND periodo_saldo = $4::date
      RETURNING
        EXTRACT(EPOCH FROM hordisponibles) / 60 AS minutos_restantes
      `,
        [String(minutosRetraso), emailAuditoria, idHorasDisponibles, periodoActual],
      );

      if (!actualizacion.length) {
        throw new BadRequestException('No se pudo actualizar el saldo mensual del empleado');
      }

      return {
        status: 'OK',
        message: 'Llegada tardía registrada y aprobada correctamente',
        data: insertados[0],
        minutosDescontados: minutosRetraso,
        saldoRestanteMinutos: Number(actualizacion[0].minutos_restantes),
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
  j.hora_entrada_establecida::text AS "horaEntradaEstablecida",
  j.hora_llegada_real::text AS "horaLlegadaReal",
  j.minutos_retraso AS "minutosRetraso",
  j.motivo,
  j.referenciadocumento AS "referenciaDocumento",
  j.hora_salida::text AS "horaSalida",
  j.hora_regreso::text AS "horaRegreso",
  j.observacion,
  j.estado,
  j.minutos_descontados AS "minutosDescontados",
  hd.hordisponibles::text AS "horasDisponibles",
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
  ) AS empleado,
  d.nomdependencia AS "dependencia"
FROM rrhh.justificaciones_llegadas_tardias j
LEFT JOIN rrhh.empleados e
  ON LOWER(TRIM(e.emailinstitucional)) =
     LOWER(TRIM(j.emailinstitucional))
LEFT JOIN rrhh.cargos c
  ON c.idcargo = e.idcargo
LEFT JOIN rrhh.dependencias d
  ON d.iddependencia = c.iddependencia
  LEFT JOIN rrhh.horas_disponibles hd
  ON LOWER(TRIM(hd.emailinstitucional)) =
     LOWER(TRIM(j.emailinstitucional))
 AND hd.periodo_saldo =
     DATE_TRUNC('month', j.fecha_llegada)::date
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
  // CONSULTAR HISTORIAL PROPIO DE LLEGADAS TARDÍAS
  // ============================================================

  async consultarMisLlegadasTardias(email: string, fechaInicio: string, fechaFinal: string) {
    this.validarRangoReporte(fechaInicio, fechaFinal);

    const emailEmpleado = email.trim().toLowerCase();

    const rows = await this.dataSource.query(
      `
      SELECT
        j.idjustificacion AS "idJustificacion",
        j.emailinstitucional AS "emailInstitucional",
        j.fecha_llegada AS "fechaLlegada",
        j.hora_entrada_establecida::text AS "horaEntradaEstablecida",
        j.hora_llegada_real::text AS "horaLlegadaReal",
        j.minutos_retraso AS "minutosRetraso",
        j.motivo,
        j.referenciadocumento AS "referenciaDocumento",
        j.hora_salida::text AS "horaSalida",
        j.hora_regreso::text AS "horaRegreso",
        j.observacion,
        j.estado,
        j.minutos_descontados AS "minutosDescontados",
        hd.hordisponibles::text AS "horasDisponibles",
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
        ) AS empleado,
        d.nomdependencia AS "dependencia"
      FROM rrhh.justificaciones_llegadas_tardias j
      LEFT JOIN rrhh.empleados e
        ON LOWER(TRIM(e.emailinstitucional)) =
           LOWER(TRIM(j.emailinstitucional))
      LEFT JOIN rrhh.cargos c
        ON c.idcargo = e.idcargo
      LEFT JOIN rrhh.dependencias d
        ON d.iddependencia = c.iddependencia
      LEFT JOIN rrhh.horas_disponibles hd
        ON LOWER(TRIM(hd.emailinstitucional)) =
           LOWER(TRIM(j.emailinstitucional))
       AND hd.periodo_saldo =
           DATE_TRUNC('month', j.fecha_llegada)::date
      WHERE j.fecha_llegada >= $1::date
        AND j.fecha_llegada < ($2::date + INTERVAL '1 day')
        AND LOWER(TRIM(j.emailinstitucional)) = $3
      ORDER BY j.fecha_llegada DESC
      `,
      [fechaInicio, fechaFinal, emailEmpleado],
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

      // 1. Bloquear el registro para impedir anulaciones simultáneas.
      const registros = await manager.query(
        `
      SELECT
        idjustificacion,
        idhorasdisponible,
        emailinstitucional,
        fecha_llegada,
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

      // 2. Obtener el período al que pertenece la justificación.
      const periodoResultado = await manager.query(
        `
      SELECT DATE_TRUNC(
        'month',
        $1::date
      )::date AS periodo
      `,
        [registro.fecha_llegada],
      );

      const periodoJustificacion = periodoResultado[0].periodo;

      // 3. Bloquear y consultar el saldo del empleado.
      const saldos = await manager.query(
        `
      SELECT
        idhorasdisponible,
        periodo_saldo
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

      const saldo = saldos[0];

      // 4. Devolver los minutos únicamente al mismo período.
      const mismoPeriodo =
        saldo.periodo_saldo &&
        String(saldo.periodo_saldo).slice(0, 10) === String(periodoJustificacion).slice(0, 10);

      let minutosDevueltos = 0;

      if (minutosDevolver > 0 && mismoPeriodo) {
        const actualizacion = await manager.query(
          `
        UPDATE rrhh.horas_disponibles
        SET
          hordisponibles =
            hordisponibles + ($1::text || ' minutes')::interval,
          actualizadoen = CURRENT_DATE,
          actualizadopor = $2
        WHERE idhorasdisponible = $3
          AND periodo_saldo = $4::date
        RETURNING idhorasdisponible
        `,
          [
            String(minutosDevolver),
            emailAuditoria,
            registro.idhorasdisponible,
            periodoJustificacion,
          ],
        );

        if (!actualizacion.length) {
          throw new BadRequestException('No se pudo devolver el saldo al período correspondiente');
        }

        minutosDevueltos = minutosDevolver;
      }

      // 5. Anular la justificación dentro de la misma transacción.
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
        message: mismoPeriodo
          ? 'Justificación anulada correctamente y saldo devuelto'
          : 'Justificación anulada correctamente. No se devolvió saldo porque corresponde a un período mensual anterior',
        data: {
          idJustificacion,
          estado: 'ANULADO',
          minutosDescontados: minutosDevolver,
          minutosDevueltos,
          saldoRestaurado: minutosDevueltos > 0,
        },
      };
    });
  }
}
