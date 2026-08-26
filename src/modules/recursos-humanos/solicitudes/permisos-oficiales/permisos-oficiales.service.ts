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

@Injectable()
export class PermisosOficialesService {
  private readonly logger = new Logger(PermisosOficialesService.name);

  constructor(
    @InjectRepository(PermisoOficial)
    private readonly repo: Repository<PermisoOficial>,

    private readonly dataSource: DataSource,
  ) {}

  findAll(): Promise<PermisoOficial[]> {
    return this.repo.find({
      order: {
        fecSolicitud: 'DESC',
      },
    });
  }

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

  async insertarPermisoOficial(dto: InsertarPermisoOficialDto, email: string): Promise<unknown> {
    try {
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

      return rows[0]?.resultado ?? null;
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
            UPPER(TRIM(es.nomestado)) AS nomestado

          FROM rrhh.permisos_oficiales po

          INNER JOIN rrhh.estados_solicitudes es
            ON es.idestadosolicitud =
               po.idestadosolicitud

          WHERE po.idpermisooficial = $1::uuid

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
       * Solamente se puede anular un permiso
       * que esté aprobado.
       */
      if (permiso.nomestado !== 'APROBADO') {
        throw new BadRequestException(
          'Solo se pueden anular permisos oficiales que estén aprobados',
        );
      }

      /*
       * Si ya tiene hora de salida,
       * significa que ya comenzó a utilizarse.
       */
      if (permiso.horsalida) {
        throw new BadRequestException(
          'No se puede anular el permiso oficial porque ya se registró la hora de salida',
        );
      }

      /*
       * Si ya tiene hora de retorno tampoco
       * debe permitirse la anulación.
       */
      if (permiso.horretorno) {
        throw new BadRequestException(
          'No se puede anular el permiso oficial porque ya se registró la hora de retorno',
        );
      }

      /*
       * Obtener el ID del estado ANULADO.
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
       * Cambiar el estado del permiso oficial
       * a ANULADO.
       */
      await manager.query(
        `
          UPDATE rrhh.permisos_oficiales

          SET
            idestadosolicitud = $2::uuid,
            actualizadoen = CURRENT_DATE,
            actualizadopor = $3

          WHERE idpermisooficial = $1::uuid
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
}
