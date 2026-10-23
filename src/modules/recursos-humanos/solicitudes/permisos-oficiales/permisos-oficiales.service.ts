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
import { PermisoOficial } from './entities/permiso-oficial.entity';
import { InsertarPermisoOficialDto } from './dto/insertar-permiso-oficial.dto';
import { NotificacionesService } from '../../notificaciones/notificaciones.service';
import { RegistrarPermisoOficialManualDto } from './dto/registrar-permiso-oficial-manual.dto';
@Injectable()
export class PermisosOficialesService {
  private readonly logger = new Logger(PermisosOficialesService.name);

  constructor(
    @InjectRepository(PermisoOficial)
    private readonly repo: Repository<PermisoOficial>,
    private readonly dataSource: DataSource,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  // =========================================================
  // LISTAR TODOS
  // =========================================================

  findAll(): Promise<PermisoOficial[]> {
    return this.repo.find({
      order: {
        fecSolicitud: 'DESC',
      },
    });
  }

  // =========================================================
  // LISTAR POR EMPLEADO
  // =========================================================

  findByEmpleado(email: string): Promise<PermisoOficial[]> {
    return this.repo.find({
      where: {
        emailInstitucional: email,
      },

      order: {
        fecSolicitud: 'DESC',
      },
    });
  }

  // =========================================================
  // BUSCAR UNO
  // =========================================================

  async findOne(id: string): Promise<PermisoOficial> {
    const permiso = await this.repo.findOne({
      where: {
        idPermisoOficial: id,
      },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso oficial ${id} no encontrado`);
    }

    return permiso;
  }

  // =========================================================
  // INSERTAR PERMISO OFICIAL
  // =========================================================

  async insertarPermisoOficial(dto: InsertarPermisoOficialDto, email: string): Promise<unknown> {
    try {
      // =======================================================
      // 1. CREAR EL PERMISO
      // =======================================================

      const rows = await this.dataSource.query(
        `
          SELECT rrhh.insertar_permiso_oficial(
            $1::character varying,
            $2::date,
            $3::character varying
          ) AS resultado
          `,
        [email, dto.fecha, dto.motivo.trim()],
      );

      const resultado = rows[0]?.resultado ?? null;

      this.logger.log(`[NOTIFICACIONES] Permiso oficial creado para ${email}`);

      // =======================================================
      // 2. BUSCAR AL EMPLEADO
      // =======================================================

      const empleados = await this.dataSource.query(
        `
          SELECT
            e.emailinstitucional,
            e.prinombre,
            e.segnombre,
            e.priapellido,
            e.segapellido,
            e.idsupinmediato
          FROM rrhh.empleados e
          WHERE LOWER(
            TRIM(e.emailinstitucional)
          ) = LOWER(
            TRIM($1)
          )
          LIMIT 1
          `,
        [email],
      );

      const empleado = empleados?.[0];

      if (!empleado) {
        this.logger.warn(`[NOTIFICACIONES] No se encontró el empleado ${email}`);

        return resultado;
      }

      // =======================================================
      // 3. VERIFICAR JEFE INMEDIATO
      // =======================================================

      if (!empleado.idsupinmediato) {
        this.logger.warn(
          `[NOTIFICACIONES] El empleado ${email} no tiene jefe inmediato configurado.`,
        );

        return resultado;
      }

      this.logger.log(`[NOTIFICACIONES] Jefe inmediato encontrado: ${empleado.idsupinmediato}`);

      // =======================================================
      // 4. BUSCAR AL JEFE EN RRHH.EMPLEADOS
      // =======================================================

      const jefes = await this.dataSource.query(
        `
          SELECT
            e.emailinstitucional,
            e.prinombre,
            e.segnombre,
            e.priapellido,
            e.segapellido
          FROM rrhh.empleados e
          WHERE TRIM(e.numidentidad) =
                TRIM($1)
          LIMIT 1
          `,
        [empleado.idsupinmediato],
      );

      const jefe = jefes?.[0];

      if (!jefe) {
        this.logger.warn(
          `[NOTIFICACIONES] No se encontró el jefe con identificación ${empleado.idsupinmediato}`,
        );

        return resultado;
      }

      // =======================================================
      // 5. BUSCAR EL USUARIO DEL JEFE
      // =======================================================

      const usuarios = await this.dataSource.query(
        `
          SELECT
            u.idusuario
          FROM core.usuarios u
          WHERE LOWER(
            TRIM(u.emailinstitucional)
          ) = LOWER(
            TRIM($1)
          )
          LIMIT 1
          `,
        [jefe.emailinstitucional],
      );

      const usuarioJefe = usuarios?.[0];

      if (!usuarioJefe) {
        this.logger.warn(
          `[NOTIFICACIONES] No existe usuario en core.usuarios para ${jefe.emailinstitucional}`,
        );

        return resultado;
      }

      // =======================================================
      // 6. NOMBRE DEL EMPLEADO
      // =======================================================

      const nombreEmpleado = [
        empleado.prinombre,
        empleado.segnombre,
        empleado.priapellido,
        empleado.segapellido,
      ]
        .filter(Boolean)
        .join(' ');

      // =======================================================
      // 7. OBTENER ID DEL PERMISO SI LA FUNCIÓN LO DEVUELVE
      // =======================================================

      let idSolicitud: string | null = null;

      if (resultado && typeof resultado === 'object') {
        const resultadoObjeto = resultado as Record<string, any>;

        idSolicitud =
          resultadoObjeto.idpermisooficial ??
          resultadoObjeto.idPermisoOficial ??
          resultadoObjeto.idpermiso ??
          resultadoObjeto.idPermiso ??
          null;
      }

      // =======================================================
      // 8. CREAR NOTIFICACIÓN
      // =======================================================

      await this.notificacionesService.crear(
        usuarioJefe.idusuario,

        'Nueva solicitud de permiso oficial',

        `El empleado ${nombreEmpleado} ha realizado una nueva solicitud de permiso oficial para el día ${dto.fecha}. Motivo: ${dto.motivo.trim()}`,

        'PERMISO_OFICIAL',

        idSolicitud,
      );

      this.logger.log(`[NOTIFICACIONES] Notificación creada para jefe ${jefe.emailinstitucional}`);

      // =======================================================
      // 9. DEVOLVER RESULTADO ORIGINAL
      // =======================================================

      return resultado;
    } catch (error) {
      this.logger.error(
        'Error en insertarPermisoOficial',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('No se pudo registrar el permiso oficial');
    }
  }

  async registrarPermisoOficialManual(
    dto: RegistrarPermisoOficialManualDto,
    emailResponsable: string,
  ): Promise<Record<string, unknown>> {
    return this.dataSource.transaction(async (manager) => {
      const emailEmpleado = dto.emailEmpleado.trim().toLowerCase();
      const emailAuditoria = emailResponsable.trim().toLowerCase();

      // Validar el orden de las fechas.
      const fechas = await manager.query(
        `
        SELECT ($2::date - $1::date) AS diferencia_dias
        `,
        [dto.fechaInicio, dto.fechaFinal],
      );

      if (Number(fechas[0].diferencia_dias) < 0) {
        throw new BadRequestException('La fecha final no puede ser anterior a la fecha de inicio');
      }

      // Calcular días hábiles: lunes a viernes, inclusive.
      // No se excluyen los días feriados.
      const resultadoDias = await manager.query(
        `
        SELECT COUNT(*)::integer AS dias_laborables
        FROM generate_series(
          $1::date,
          $2::date,
          INTERVAL '1 day'
        ) AS dia
        WHERE EXTRACT(ISODOW FROM dia) BETWEEN 1 AND 5
        `,
        [dto.fechaInicio, dto.fechaFinal],
      );

      const diasLaborables = Number(resultadoDias[0].dias_laborables);

      if (diasLaborables < 1) {
        throw new BadRequestException('El rango debe incluir al menos un día de lunes a viernes');
      }

      // Verificar que exista el empleado.
      const empleados = await manager.query(
        `
        SELECT emailinstitucional
        FROM rrhh.empleados
        WHERE LOWER(TRIM(emailinstitucional)) = $1
        LIMIT 1
        `,
        [emailEmpleado],
      );

      if (!empleados.length) {
        throw new NotFoundException('No se encontró el empleado con ese correo institucional');
      }

      // Obtener el tipo de solicitud.
      const tipos = await manager.query(
        `
        SELECT idtiposolicitud
        FROM rrhh.tipos_solicitudes_empleados
        WHERE UPPER(TRIM(nomtipo)) = 'PERMISO OFICIAL'
        LIMIT 1
        `,
      );

      if (!tipos.length) {
        throw new InternalServerErrorException('No se encontró el tipo PERMISO OFICIAL');
      }

      // Obtener el estado aprobado.
      const estados = await manager.query(
        `
        SELECT idestadosolicitud
        FROM rrhh.estados_solicitudes
        WHERE UPPER(TRIM(nomestado)) = 'APROBADO'
        LIMIT 1
        `,
      );

      if (!estados.length) {
        throw new InternalServerErrorException('No se encontró el estado APROBADO');
      }

      // Registrar directamente como aprobado.
      // No se llama al método normal ni se envían notificaciones.
      const insertados = await manager.query(
        `
        INSERT INTO rrhh.permisos_oficiales (
          idtiposolicitud,
          emailinstitucional,
          fecsolicitud,
          idestadosolicitud,
          motivo,
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
          fecinicio,
          fecfinal,
          diaslaborables,
          observacion
        )
        VALUES (
          $1::uuid,
          $2,
          CURRENT_DATE,
          $3::uuid,
          $4,
          NULL,
          NULL,
          NULL,
          NULL,
          $10::time,
          $11::time,
          NULL,
          CURRENT_DATE,
          $5,
          TRUE,
          $6,
          $7::date,
          $8::date,
          $9,
          $12
        )
        RETURNING idpermisooficial
        `,
        [
          tipos[0].idtiposolicitud,
          emailEmpleado,
          estados[0].idestadosolicitud,
          dto.motivo.trim(),
          emailAuditoria,
          dto.referenciaDocumento?.trim() || null,
          dto.fechaInicio,
          dto.fechaFinal,
          diasLaborables,
          dto.horaSalida?.trim() || null,
          dto.horaRegreso?.trim() || null,
          dto.observacion?.trim() || null,
        ],
      );

      return {
        status: 'OK',
        message: 'Permiso oficial manual registrado como aprobado',
        idPermisoOficial: insertados[0].idpermisooficial,
        emailEmpleado,
        fechaInicio: dto.fechaInicio,
        fechaFinal: dto.fechaFinal,
        diasLaborables,
        horaSalida: dto.horaSalida?.trim() || null,
        horaRegreso: dto.horaRegreso?.trim() || null,
        observacion: dto.observacion?.trim() || null,
        esManual: true,
        referenciaDocumento: dto.referenciaDocumento?.trim() || null,
      };
    });
  }

  // =========================================================
  // ANULAR PERMISO OFICIAL
  // =========================================================

  async anularPermisoOficial(idPermiso: string, email: string) {
    return this.dataSource.transaction(async (manager) => {
      /*
       * Buscar el permiso y bloquear el registro
       * durante la transacción.
       */

      const permisos = await manager.query(
        `
            SELECT
              po.idpermisooficial,
              po.emailinstitucional,
              po.horsalida,
              po.horretorno,
              po.idestadosolicitud,
              UPPER(
                TRIM(es.nomestado)
              ) AS nomestado

            FROM rrhh.permisos_oficiales po

            INNER JOIN rrhh.estados_solicitudes es
              ON es.idestadosolicitud =
                 po.idestadosolicitud

            WHERE po.idpermisooficial =
                  $1::uuid

              AND LOWER(
                TRIM(po.emailinstitucional)
              ) =
              LOWER(
                TRIM($2)
              )

            FOR UPDATE
            `,
        [idPermiso, email],
      );

      const permiso = permisos?.[0];

      /*
       * Verificar que exista y pertenezca
       * al empleado autenticado.
       */

      if (!permiso) {
        throw new NotFoundException(
          'El permiso oficial no existe o no pertenece al usuario autenticado',
        );
      }

      /*
       * Solamente se puede anular
       * un permiso aprobado.
       */

      if (permiso.nomestado !== 'EN PROCESO' && permiso.nomestado !== 'APROBADO') {
        throw new BadRequestException(
          'Solo se pueden anular permisos oficiales que estén en proceso o aprobados',
        );
      }

      /*
       * Si ya tiene hora de salida,
       * ya comenzó a utilizarse.
       */

      if (permiso.horsalida) {
        throw new BadRequestException(
          'No se puede anular el permiso oficial porque ya se registró la hora de salida',
        );
      }

      /*
       * Si ya tiene hora de retorno,
       * tampoco puede anularse.
       */

      if (permiso.horretorno) {
        throw new BadRequestException(
          'No se puede anular el permiso oficial porque ya se registró la hora de retorno',
        );
      }

      /*
       * Obtener ID del estado ANULADO.
       */

      const estadosAnulado = await manager.query(
        `
            SELECT
              idestadosolicitud

            FROM rrhh.estados_solicitudes

            WHERE UPPER(
              TRIM(nomestado)
            ) = 'ANULADO'

            LIMIT 1
            `,
      );

      if (!estadosAnulado?.length) {
        throw new InternalServerErrorException('No se encontró el estado ANULADO');
      }

      const idEstadoAnulado = estadosAnulado[0].idestadosolicitud;

      /*
       * Cambiar estado a ANULADO.
       */

      await manager.query(
        `
          UPDATE rrhh.permisos_oficiales

          SET
            idestadosolicitud =
              $2::uuid,

            actualizadoen =
              CURRENT_DATE,

            actualizadopor =
              $3

          WHERE idpermisooficial =
                $1::uuid
          `,
        [idPermiso, idEstadoAnulado, email],
      );

      return {
        status: 'OK',
        message: 'Permiso oficial anulado correctamente',
        idPermiso,
      };
    });
  }

  async consultarReporteManual(fechaInicio: string, fechaFinal: string) {
    this.validarRangoReporte(fechaInicio, fechaFinal);

    const rows = await this.dataSource.query(
      `
      SELECT
        po.idpermisooficial AS "idPermiso",
        po.emailinstitucional AS "emailInstitucional",
        po.fecinicio AS "fechaInicio",
        po.fecfinal AS "fechaFinal",
        po.diaslaborables AS "diasLaborables",
        po.horsalida::text AS "horaSalida",
        po.horretorno::text AS "horaRegreso",
        po.observacion AS observacion,
        po.motivo AS motivo,
        po.referenciadocumento AS "referenciaDocumento",
        UPPER(TRIM(es.nomestado)) AS estado,
        CONCAT_WS(
          ' ',
          e.prinombre,
          e.segnombre,
          e.priapellido,
          e.segapellido
        ) AS empleado,
        po.creadoen AS "fechaRegistro",
        po.creadopor AS "registradoPor"
      FROM rrhh.permisos_oficiales po
      INNER JOIN rrhh.estados_solicitudes es
        ON es.idestadosolicitud = po.idestadosolicitud
      LEFT JOIN rrhh.empleados e
        ON LOWER(TRIM(e.emailinstitucional)) =
           LOWER(TRIM(po.emailinstitucional))
      WHERE po.esmanual = TRUE
        AND po.fecinicio <= $2::date
        AND po.fecfinal >= $1::date
      ORDER BY po.fecinicio DESC, empleado ASC
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
}
