import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { Empleado } from './entities/empleado.entity';
import { HistorialCargo } from './entities/historial-cargo.entity';
import { HorasDisponible } from './entities/horas-disponible.entity';
import { CrearEmpleadoDto } from './dto/crear-empleado.dto';
import { ActualizarEmpleadoDto } from './dto/actualizar-empleado.dto';

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(
    @InjectRepository(Empleado) private readonly empleadoRepo: Repository<Empleado>,
    @InjectRepository(HistorialCargo) private readonly historialRepo: Repository<HistorialCargo>,
    @InjectRepository(HorasDisponible) private readonly horasRepo: Repository<HorasDisponible>,
    private readonly dataSource: DataSource,
  ) {}

  findAll() {
    return this.empleadoRepo.find({
      relations: ['cargo', 'tipoContratacion', 'sexo', 'estadoCivil'],
    });
  }

  async findOne(email: string) {
    const empleado = await this.empleadoRepo.findOne({
      where: { emailInstitucional: email },
      relations: ['cargo', 'tipoContratacion', 'sexo', 'estadoCivil', 'municipio'],
    });
    if (!empleado) throw new NotFoundException(`Empleado ${email} no encontrado`);
    return empleado;
  }

  crear(dto: CrearEmpleadoDto) {
    const empleado = this.empleadoRepo.create(dto);
    return this.empleadoRepo.save(empleado);
  }

  async actualizar(email: string, dto: ActualizarEmpleadoDto) {
    await this.findOne(email);
    await this.empleadoRepo.update({ emailInstitucional: email }, dto as Partial<Empleado>);
    return this.findOne(email);
  }

  findHistorial(email: string) {
    return this.historialRepo.find({ where: { emailInstitucional: email } });
  }

  findHorasDisponibles(email: string) {
    return this.horasRepo.find({ where: { emailInstitucional: email } });
  }

  async buscarEmpleadoAdmin(
    emailEmpleado: string,
    emailAdmin: string,
    rol: number,
    idmodulo: number,
  ) {
    try {
      const rows = await this.dataSource.query('SELECT rrhh.buscar_empleado($1, $2, $3, $4)', [
        emailEmpleado,
        emailAdmin,
        String(rol),
        String(idmodulo),
      ]);
      return rows[0]?.buscar_empleado ?? null;
    } catch (error) {
      this.logger.error(`Error en buscarEmpleadoAdmin: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }

  async obtenerDatosSedh() {
    try {
      const rows = await this.dataSource.query('SELECT rrhh.obtener_datos_sedh()');
      return rows[0]?.obtener_datos_sedh ?? null;
    } catch (error) {
      this.logger.error(`Error en obtenerDatosSedh: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }

  async actualizarEmpleadoAdmin(
    emailEmpleado: string,
    emailAdmin: string,
    rol: number,
    idmodulo: number,
    payload: {
      empleado: object;
      accesosSistema: Array<{
        idRol: number;
        idModulo: number;
      }>;
    },
  ) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const rows = await manager.query(
          `
          SELECT rrhh.actualizar_empleado(
            $1,
            $2,
            $3,
            $4,
            $5
          ) AS resultado
          `,
          [emailEmpleado, emailAdmin, String(rol), String(idmodulo), JSON.stringify(payload)],
        );

        const resultado = rows[0]?.resultado ?? null;

        if (resultado?.status === 'ERROR') {
          throw new BadRequestException(
            resultado?.mensaje ?? resultado?.message ?? 'No se pudo actualizar el empleado',
          );
        }

        const usuarios = await manager.query(
          `
            SELECT u.idusuario
            FROM core.usuarios u
            WHERE LOWER(
                    TRIM(
                      u.emailinstitucional
                    )
                  ) =
                  LOWER(TRIM($1))
            LIMIT 1
            `,
          [emailEmpleado],
        );

        const idUsuario = usuarios[0]?.idusuario;

        if (!idUsuario) {
          throw new NotFoundException(`No existe el usuario del sistema para ${emailEmpleado}`);
        }

        const idsRoles = [
          ...new Set(
            payload.accesosSistema
              .map((acceso) => Number(acceso.idRol))
              .filter((idRol) => Number.isInteger(idRol) && idRol > 0),
          ),
        ];

        if (idsRoles.length === 0) {
          throw new BadRequestException('Debe asignar al menos un rol al empleado');
        }

        await manager.query(
          `
          DELETE FROM core.usuario_roles
          WHERE idusuario = $1::uuid
          `,
          [idUsuario],
        );

        for (const idRol of idsRoles) {
          await manager.query(
            `
            INSERT INTO core.usuario_roles (
              idusuario,
              idrol
            )
            VALUES (
              $1::uuid,
              $2::smallint
            )
            `,
            [idUsuario, idRol],
          );
        }

        return {
          ...(resultado ?? {}),
          status: 'OK',
          mensaje:
            resultado?.mensaje ??
            resultado?.message ??
            'Empleado y accesos actualizados correctamente',
          email: emailEmpleado,
          rolesActualizados: idsRoles,
        };
      });
    } catch (error: unknown) {
      this.logger.error(
        'Error en actualizarEmpleadoAdmin',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'No se pudo actualizar el empleado',
      );
    }
  }

  async crearEmpleadoAdmin(
    emailAdmin: string,
    rol: number,
    idmodulo: number,
    payload: { contrasena: string; empleado: object; accesosSistema: object[] },
  ) {
    try {
      const rows = await this.dataSource.query('SELECT rrhh.crear_empleado($1, $2, $3, $4)', [
        emailAdmin,
        String(rol),
        String(idmodulo),
        JSON.stringify(payload),
      ]);
      return rows[0]?.crear_empleado ?? null;
    } catch (error) {
      this.logger.error(`Error en crearEmpleadoAdmin: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }

  async actualizarHorasDisponibles(
    emailEmpleado: string,
    horasDisponibles: string,
    emailAdmin: string,
    rol: number,
    idmodulo: number,
  ) {
    try {
      const rows = await this.dataSource.query(
        'SELECT rrhh.actualizar_horas_disponibles_empleado($1, $2, $3, $4, $5)',
        [emailEmpleado, horasDisponibles, emailAdmin, String(rol), String(idmodulo)],
      );
      return rows[0]?.actualizar_horas_disponibles_empleado ?? null;
    } catch (error) {
      this.logger.error(`Error en actualizarHorasDisponibles: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }
  async listarEmpleados(termino?: string) {
    const query = this.empleadoRepo
      .createQueryBuilder('empleado')
      .leftJoinAndSelect('empleado.cargo', 'cargo')
      .leftJoinAndSelect('empleado.sexo', 'sexo')
      .leftJoinAndSelect('empleado.estadoCivil', 'estadoCivil')
      .leftJoinAndSelect('empleado.tipoContratacion', 'tipoContratacion')
      .orderBy('empleado.priApellido', 'ASC')
      .addOrderBy('empleado.priNombre', 'ASC');
    const busqueda = termino?.trim();
    if (busqueda) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            `
          LOWER(empleado.priNombre)
          LIKE LOWER(:buscar)
          `,
            {
              buscar: `%${busqueda}%`,
            },
          )
            .orWhere(
              `
            LOWER(empleado.priApellido)
            LIKE LOWER(:buscar)
            `,
              {
                buscar: `%${busqueda}%`,
              },
            )
            .orWhere(
              `
            LOWER(empleado.emailInstitucional)
            LIKE LOWER(:buscar)
            `,
              {
                buscar: `%${busqueda}%`,
              },
            )
            .orWhere(
              `
            empleado.numIdentidad
            LIKE :buscar
            `,
              {
                buscar: `%${busqueda}%`,
              },
            );
        }),
      );
    }
    const empleados = await query.getMany();
    return empleados.map((empleado) => ({
      emailInstitucional: empleado.emailInstitucional,
      priNombre: empleado.priNombre,
      segNombre: empleado.segNombre,
      priApellido: empleado.priApellido,
      segApellido: empleado.segApellido,
      numIdentidad: empleado.numIdentidad,
      numTelefono: empleado.numTelefono,
      fecIngLaboral: empleado.fecIngLaboral,
      activo: empleado.actLaboralmente ?? false,
      cargo: empleado.cargo ?? null,
      tipoContratacion: empleado.tipoContratacion ?? null,
    }));
  }
  async vincularUsuarioEmpleado(
    idUsuario: string,
    empleado: {
      fecIngLaboral: string;
      actLaboralmente: boolean;
      numIdentidad: string;
      numTelefono?: string | null;
      idTipoContratacion: string;
      idCargo: number;
      idSupInmediato?: string | null;
      idSexo: string;
      idEstadoCivil: string;
      idMunicipio?: number | null;
    },
    emailAdmin: string,
  ) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const usuarios = await manager.query(
          `
            SELECT
              idusuario,
              emailinstitucional,
              prinombre,
              segnombre,
              priapellido,
              segapellido
            FROM core.usuarios
            WHERE idusuario = $1::uuid
              AND activo = TRUE
            LIMIT 1
            `,
          [idUsuario],
        );

        const usuario = usuarios?.[0];

        if (!usuario) {
          throw new NotFoundException('El usuario no existe o está inactivo');
        }

        if (!usuario.prinombre || !usuario.priapellido) {
          throw new BadRequestException('El usuario no tiene nombre y apellido registrados');
        }

        const empleadosExistentes = await manager.query(
          `
            SELECT
              emailinstitucional
            FROM rrhh.empleados
            WHERE
              idusuario = $1::uuid
              OR LOWER(TRIM(emailinstitucional)) =
                 LOWER(TRIM($2))
            LIMIT 1
            `,
          [idUsuario, usuario.emailinstitucional],
        );

        if (empleadosExistentes?.length) {
          throw new BadRequestException('El usuario ya está vinculado a un empleado');
        }

        await manager.query(
          `
          INSERT INTO rrhh.empleados (
            emailinstitucional,
            prinombre,
            segnombre,
            priapellido,
            segapellido,
            fecinglaborar,
            actlaboralmente,
            numidentidad,
            numtelefono,
            idtipocontratacion,
            idcargo,
            idsupinmediato,
            idsexo,
            idestadocivil,
            idmunicipio,
            creadoen,
            creadopor,
            idusuario
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6::date,
            $7::boolean,
            $8,
            $9,
            $10::uuid,
            $11::smallint,
            $12,
            $13::uuid,
            $14::uuid,
            $15::smallint,
            CURRENT_DATE,
            $16,
            $17::uuid
          )
          `,
          [
            usuario.emailinstitucional,
            usuario.prinombre,
            usuario.segnombre,
            usuario.priapellido,
            usuario.segapellido,
            empleado.fecIngLaboral,
            empleado.actLaboralmente,
            empleado.numIdentidad.trim(),
            empleado.numTelefono?.trim() || null,
            empleado.idTipoContratacion,
            empleado.idCargo,
            empleado.idSupInmediato?.trim() || null,
            empleado.idSexo,
            empleado.idEstadoCivil,
            empleado.idMunicipio ?? null,
            emailAdmin,
            idUsuario,
          ],
        );

        await manager.query(
          `
          INSERT INTO rrhh.horas_disponibles (
            emailinstitucional,
            hordisponibles,
            creadoen,
            creadopor,
            actualizadoen,
            actualizadopor
          )
          SELECT
            $1,
            '09:00:00'::time,
            CURRENT_DATE,
            $2,
            CURRENT_DATE,
            $2
          WHERE NOT EXISTS (
            SELECT 1
            FROM rrhh.horas_disponibles
            WHERE LOWER(
                    TRIM(emailinstitucional)
                  ) =
                  LOWER(TRIM($1))
          )
          `,
          [usuario.emailinstitucional, emailAdmin],
        );

        return {
          status: 'OK',
          mensaje: 'Usuario vinculado al empleado correctamente',
          idUsuario,
          emailInstitucional: usuario.emailinstitucional,
        };
      });
    } catch (error: unknown) {
      this.logger.error(
        'Error en vincularUsuarioEmpleado',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'No se pudo vincular el empleado',
      );
    }
  }
}
