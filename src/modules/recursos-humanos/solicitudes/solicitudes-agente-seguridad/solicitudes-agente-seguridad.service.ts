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

      const rows = await this.dataSource.query(
        `
          SELECT
            pp.idpermisopersonal
              AS idpermiso,

            pp.fecsolicitud
              AS fecha,

            'PERMISO PERSONAL'
              AS tipo,

            es.nomestado
              AS estado,

            pp.motivo,

            pp.horsolicitadas::text
              AS "horasSolicitadas",

            pp.horsalida::text
              AS "horaSalida",

            pp.horretorno::text
              AS "horaRetorno",

            pp.emailinstitucional
              AS email,

            json_build_object(
              'nombre',
                e.prinombre,
              'segundoNombre',
                e.segnombre,
              'apellido',
                e.priapellido,
              'segundoApellido',
                e.segapellido
            ) AS empleado,

            c.nomcargo
              AS cargo,

            d.nomdependencia
              AS dependencia,

            'PERSONAL'
              AS "tipoPermiso"

          FROM rrhh.permisos_personales pp

          INNER JOIN rrhh.estados_solicitudes es
            ON es.idestadosolicitud =
               pp.idestadosolicitud

          INNER JOIN rrhh.empleados e
            ON LOWER(
                 TRIM(
                   e.emailinstitucional
                 )
               ) =
               LOWER(
                 TRIM(
                   pp.emailinstitucional
                 )
               )

          LEFT JOIN rrhh.cargos c
            ON c.idcargo =
               e.idcargo

          LEFT JOIN rrhh.dependencias d
            ON d.iddependencia =
               c.iddependencia

          WHERE UPPER(
                  TRIM(
                    es.nomestado
                  )
                ) =
                'APROBADO'

            AND pp.fecsolicitud =
                CURRENT_DATE

          ORDER BY
            pp.fecsolicitud ASC,
            e.priapellido ASC,
            e.prinombre ASC
          `,
      );

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
      const rows = await this.dataSource.query(
        `
          UPDATE rrhh.permisos_personales
          SET
            horsalida =
              $2::time,

            guardiaturno =
              $3,

            actualizadoen =
              CURRENT_DATE,

            actualizadopor =
              $3

          WHERE idpermisopersonal =
                $1::uuid

            AND horsalida IS NULL

            AND horretorno IS NULL

          RETURNING
            idpermisopersonal,
            horsalida
          `,
        [dto.idPermiso, dto.horaSalida, user.email],
      );

      if (!rows?.length) {
        throw new BadRequestException(
          'No se pudo registrar la salida. Puede que ya haya sido registrada.',
        );
      }

      return {
        status: 'OK',
        tipo: 'PERMISO PERSONAL',
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
      return await this.dataSource.transaction(async (manager) => {
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
          [dto.idPermiso],
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
                  (
                    EXTRACT(
                      EPOCH FROM (
                        $1::time -
                        $2::time
                      )
                    ) / 60
                  )::integer
                    AS minutos_reales,

                  (
                    EXTRACT(
                      EPOCH FROM
                        $3::time
                    ) / 60
                  )::integer
                    AS minutos_solicitados
                `,
          [dto.horaRetorno, permiso.horsalida, permiso.horsolicitadas],
        );
        const minutosReales = Number(calculo[0]?.minutos_reales ?? 0);
        const minutosSolicitados = Number(calculo[0]?.minutos_solicitados ?? 0);
        if (minutosReales <= 0) {
          throw new BadRequestException(
            'La hora de retorno debe ser posterior a la hora de salida',
          );
        }
        const minutosDevueltos = Math.max(0, minutosSolicitados - minutosReales);
        await manager.query(
          `
              UPDATE rrhh.permisos_personales
              SET
                horretorno =
                  $2::time,

                guardiaturno =
                  $3,

                actualizadoen =
                  CURRENT_DATE,

                actualizadopor =
                  $3

              WHERE idpermisopersonal =
                    $1::uuid
              `,
          [dto.idPermiso, dto.horaRetorno, user.email],
        );

        if (minutosDevueltos > 0) {
          await manager.query(
            `
                UPDATE rrhh.horas_disponibles
                SET
                  hordisponibles =
                    (
                      hordisponibles::interval +
                      (
                        $2 ||
                        ' minutes'
                      )::interval
                    )::time,

                  actualizadoen =
                    CURRENT_DATE,

                  actualizadopor =
                    $3

                WHERE LOWER(
                        TRIM(
                          emailinstitucional
                        )
                      ) =
                      LOWER(
                        TRIM(
                          $1
                        )
                      )
                `,
            [permiso.emailinstitucional, minutosDevueltos, user.email],
          );
        }

        return {
          status: 'OK',

          tipo: 'PERMISO PERSONAL',
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
}
