import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CargarSolicitudesAgenteDto } from './dto/cargar-solicitudes-agente.dto';
import { RegistrarHoraSalidaDto } from './dto/registrar-hora-salida.dto';
import { RegistrarHoraRetornoDto } from './dto/registrar-hora-retorno.dto';
import { JwtPayload } from '../../../../core/auth/strategies/jwt.strategy';
import { MarcarNoRetornoDto } from './dto/marcar-no-retorno.dto';

@Injectable()
export class SolicitudesAgenteSeguridadService {
  private readonly logger = new Logger(SolicitudesAgenteSeguridadService.name);
  constructor(private readonly dataSource: DataSource) {}
  private obtenerRolAgente(user: JwtPayload): number {
    const rol = user.roles?.find((item) => [4, 5].includes(Number(item.r)));

    if (!rol) {
      throw new ForbiddenException('El usuario no tiene un rol autorizado para este módulo');
    }

    return Number(rol.r);
  }

  async cargarSolicitudes(dto: CargarSolicitudesAgenteDto, user: JwtPayload) {
    try {
      const rol = this.obtenerRolAgente(user);

      const rows = await this.dataSource.query(`
      SELECT *
      FROM (
        SELECT
          pp.idpermisopersonal AS idpermiso,
          pp.fecsolicitud AS fecha,
          'PERMISO PERSONAL' AS tipo,
          es.nomestado AS estado,
          pp.motivo,
          pp.horsolicitadas::text AS "horasSolicitadas",
          pp.horsalida::text AS "horaSalida",
          pp.horretorno::text AS "horaRetorno",
          pp.estadoretorno AS "estadoRetorno",
          pp.emailinstitucional AS email,

          json_build_object(
            'nombre', e.prinombre,
            'segundoNombre', e.segnombre,
            'apellido', e.priapellido,
            'segundoApellido', e.segapellido
          ) AS empleado,

          c.nomcargo AS cargo,
          d.nomdependencia AS dependencia,
          'PERSONAL' AS "tipoPermiso"

        FROM rrhh.permisos_personales pp

        INNER JOIN rrhh.estados_solicitudes es
          ON es.idestadosolicitud = pp.idestadosolicitud

        INNER JOIN rrhh.empleados e
          ON LOWER(TRIM(e.emailinstitucional)) =
             LOWER(TRIM(pp.emailinstitucional))

        LEFT JOIN rrhh.cargos c
          ON c.idcargo = e.idcargo

        LEFT JOIN rrhh.dependencias d
          ON d.iddependencia = c.iddependencia

        WHERE UPPER(TRIM(es.nomestado)) = 'APROBADO'

        UNION ALL

        SELECT
          po.idpermisooficial AS idpermiso,
          po.fecsolicitud AS fecha,
          'PERMISO OFICIAL' AS tipo,
          es.nomestado AS estado,
          po.motivo,
          po.tiempolimite::text AS "horasSolicitadas",
          po.horsalida::text AS "horaSalida",
          po.horretorno::text AS "horaRetorno",
          po.estadoretorno AS "estadoRetorno",
          po.emailinstitucional AS email,

          json_build_object(
            'nombre', e.prinombre,
            'segundoNombre', e.segnombre,
            'apellido', e.priapellido,
            'segundoApellido', e.segapellido
          ) AS empleado,

          c.nomcargo AS cargo,
          d.nomdependencia AS dependencia,
          'OFICIAL' AS "tipoPermiso"

        FROM rrhh.permisos_oficiales po

        INNER JOIN rrhh.estados_solicitudes es
          ON es.idestadosolicitud = po.idestadosolicitud

        INNER JOIN rrhh.empleados e
          ON LOWER(TRIM(e.emailinstitucional)) =
             LOWER(TRIM(po.emailinstitucional))

        LEFT JOIN rrhh.cargos c
          ON c.idcargo = e.idcargo

        LEFT JOIN rrhh.dependencias d
          ON d.iddependencia = c.iddependencia

        WHERE UPPER(TRIM(es.nomestado)) = 'APROBADO'
      ) AS solicitudes

      ORDER BY
        fecha ASC,
        tipo ASC
    `);

      return {
        status: 'OK',
        rol,
        modulo: Number(dto.idmodulo),
        solicitudesAgente: rows,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error en cargarSolicitudes',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Ocurrió un error al cargar las solicitudes');
    }
  }

  async registrarHoraSalida(dto: RegistrarHoraSalidaDto, user: JwtPayload) {
    try {
      this.obtenerRolAgente(user);

      const esOficial = dto.tipoPermiso === 'OFICIAL';

      const tabla = esOficial ? 'rrhh.permisos_oficiales' : 'rrhh.permisos_personales';

      const campoId = esOficial ? 'idpermisooficial' : 'idpermisopersonal';

      const rows = await this.dataSource.query(
        `
        UPDATE ${tabla}
        SET
          horsalida = $2::time,
          estadoretorno = 'FUERA',
          guardiaturno = $3,
          actualizadoen = CURRENT_DATE,
          actualizadopor = $3
        WHERE ${campoId} = $1::uuid
          AND horsalida IS NULL
          AND horretorno IS NULL
        RETURNING
          ${campoId},
          horsalida
      `,
        [dto.idPermiso, dto.horaSalida, user.email],
      );

      if (!rows?.length) {
        throw new BadRequestException(
          'No se pudo registrar la salida. Puede que el permiso ya tenga una salida o retorno registrado.',
        );
      }

      return {
        status: 'OK',
        tipo: esOficial ? 'PERMISO OFICIAL' : 'PERMISO PERSONAL',
        tipoPermiso: dto.tipoPermiso,
        idpermiso: dto.idPermiso,
        mensaje: 'Hora de salida registrada correctamente',
        horaSalida: rows[0].horsalida,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error en registrarHoraSalida',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Ocurrió un error al registrar la hora de salida');
    }
  }

  async registrarHoraRetorno(dto: RegistrarHoraRetornoDto, user: JwtPayload) {
    try {
      this.obtenerRolAgente(user);

      const esOficial = dto.tipoPermiso === 'OFICIAL';

      return await this.dataSource.transaction(async (manager) => {
        const tabla = esOficial ? 'rrhh.permisos_oficiales' : 'rrhh.permisos_personales';

        const campoId = esOficial ? 'idpermisooficial' : 'idpermisopersonal';

        const campoTiempo = esOficial ? 'tiempolimite' : 'horsolicitadas';

        const permisos = await manager.query(
          `
          SELECT
            emailinstitucional,
            ${campoTiempo} AS tiempo_solicitado,
            horsalida,
            horretorno,
            estadoretorno
          FROM ${tabla}
          WHERE ${campoId} = $1::uuid
          FOR UPDATE
        `,
          [dto.idPermiso],
        );

        const permiso = permisos?.[0];

        if (!permiso) {
          throw new NotFoundException(
            esOficial ? 'Permiso oficial no encontrado' : 'Permiso personal no encontrado',
          );
        }

        if (!permiso.horsalida) {
          throw new BadRequestException('Debe registrar primero la hora de salida');
        }

        if (permiso.estadoretorno === 'NO_RETORNO') {
          throw new BadRequestException(
            'El permiso está marcado como no retornado y no puede registrar un retorno.',
          );
        }

        if (permiso.horretorno) {
          throw new BadRequestException('La hora de retorno ya fue registrada');
        }

        const calculo = await manager.query(
          `
          SELECT
            (
              EXTRACT(
                EPOCH FROM ($1::time - $2::time)
              ) / 60
            )::integer AS minutos_reales,

            (
              EXTRACT(EPOCH FROM $3::time) / 60
            )::integer AS minutos_solicitados
        `,
          [dto.horaRetorno, permiso.horsalida, permiso.tiempo_solicitado],
        );

        const minutosReales = Number(calculo[0]?.minutos_reales ?? 0);
        const minutosSolicitados = Number(calculo[0]?.minutos_solicitados ?? 0);

        if (minutosReales <= 0) {
          throw new BadRequestException(
            'La hora de retorno debe ser posterior a la hora de salida',
          );
        }

        await manager.query(
          `
          UPDATE ${tabla}
          SET
            horretorno = $2::time,
            estadoretorno = 'RETORNADO',
            guardiaturno = $3,
            actualizadoen = CURRENT_DATE,
            actualizadopor = $3
          WHERE ${campoId} = $1::uuid
        `,
          [dto.idPermiso, dto.horaRetorno, user.email],
        );

        let minutosDevueltos = 0;

        // La devolución de minutos aplica únicamente a permisos personales.
        if (!esOficial) {
          minutosDevueltos = Math.max(0, minutosSolicitados - minutosReales);

          if (minutosDevueltos > 0) {
            await manager.query(
              `
              UPDATE rrhh.horas_disponibles
              SET
                hordisponibles = (
                  hordisponibles::interval +
                  ($2 || ' minutes')::interval
                )::time,
                actualizadoen = CURRENT_DATE,
                actualizadopor = $3
              WHERE LOWER(TRIM(emailinstitucional)) =
                    LOWER(TRIM($1))
            `,
              [permiso.emailinstitucional, minutosDevueltos, user.email],
            );
          }
        }

        return {
          status: 'OK',
          tipo: esOficial ? 'PERMISO OFICIAL' : 'PERMISO PERSONAL',
          tipoPermiso: dto.tipoPermiso,
          idpermiso: dto.idPermiso,
          mensaje: 'Hora de retorno registrada correctamente',
          minutosSolicitados,
          minutosReales,
          minutosDevueltos,
        };
      });
    } catch (error: unknown) {
      this.logger.error(
        'Error en registrarHoraRetorno',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Ocurrió un error al registrar la hora de retorno');
    }
  }

  async marcarNoRetorno(dto: MarcarNoRetornoDto, user: JwtPayload) {
    try {
      this.obtenerRolAgente(user);

      const esOficial = dto.tipoPermiso === 'OFICIAL';

      return await this.dataSource.transaction(async (manager) => {
        const tabla = esOficial ? 'rrhh.permisos_oficiales' : 'rrhh.permisos_personales';

        const campoId = esOficial ? 'idpermisooficial' : 'idpermisopersonal';

        const permisos = await manager.query(
          `
          SELECT
            horsalida,
            horretorno,
            estadoretorno
          FROM ${tabla}
          WHERE ${campoId} = $1::uuid
          FOR UPDATE
        `,
          [dto.idPermiso],
        );

        const permiso = permisos?.[0];

        if (!permiso) {
          throw new NotFoundException(
            esOficial ? 'Permiso oficial no encontrado' : 'Permiso personal no encontrado',
          );
        }

        if (!permiso.horsalida) {
          throw new BadRequestException('Debe registrar primero la hora de salida');
        }

        if (permiso.horretorno || permiso.estadoretorno === 'RETORNADO') {
          throw new BadRequestException('El permiso ya tiene un retorno registrado');
        }

        if (permiso.estadoretorno === 'NO_RETORNO') {
          throw new BadRequestException('El permiso ya está marcado como no retornado');
        }

        await manager.query(
          `
          UPDATE ${tabla}
          SET
            estadoretorno = 'NO_RETORNO',
            guardiaturno = $2,
            actualizadoen = CURRENT_DATE,
            actualizadopor = $2
          WHERE ${campoId} = $1::uuid
        `,
          [dto.idPermiso, user.email],
        );

        return {
          status: 'OK',
          tipo: esOficial ? 'PERMISO OFICIAL' : 'PERMISO PERSONAL',
          tipoPermiso: dto.tipoPermiso,
          idpermiso: dto.idPermiso,
          mensaje: 'Permiso marcado como no retornado',
        };
      });
    } catch (error: unknown) {
      this.logger.error(
        'Error en marcarNoRetorno',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Ocurrió un error al marcar el permiso como no retornado',
      );
    }
  }
}
