import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, Repository } from 'typeorm';
import { Empleado } from './entities/empleado.entity';
import { HistorialCargo } from './entities/historial-cargo.entity';
import { HorasDisponible } from './entities/horas-disponible.entity';
import { CrearEmpleadoDto } from './dto/crear-empleado.dto';
import { ActualizarEmpleadoDto } from './dto/actualizar-empleado.dto';

// =========================================================
// JEFES INMEDIATOS OFICIALES
//
// ROL 2 = JEFE INMEDIATO
//
// Las dependencias que no tienen una persona definida
// aquí quedan disponibles para asignar posteriormente.
// =========================================================

const JEFES_INMEDIATOS_OFICIALES = [
  'sumaya.zuniga@sedh.gob.hn',
  'nelson.barahona@sedh.gob.hn',
  'cristobal.martinez@sedh.gob.hn',
  'suanny.erazo@sedh.gob.hn',
  'kathia.crivelli@sedh.gob.hn',
  'roman.padilla@sedh.gob.hn',
  'olman.soto@sedh.gob.hn',
].map((email) => email.toLowerCase().trim());

@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,

    @InjectRepository(HistorialCargo)
    private readonly historialRepo: Repository<HistorialCargo>,

    @InjectRepository(HorasDisponible)
    private readonly horasRepo: Repository<HorasDisponible>,

    private readonly dataSource: DataSource,
  ) {}

  // =========================================================
  // OBTENER TODOS LOS EMPLEADOS
  // =========================================================

  findAll() {
    return this.empleadoRepo.find({
      relations: ['cargo', 'tipoContratacion', 'sexo', 'estadoCivil'],
    });
  }

  // =========================================================
  // OBTENER EMPLEADO
  // =========================================================

  async findOne(email: string) {
    const empleado = await this.empleadoRepo.findOne({
      where: {
        emailInstitucional: email,
      },

      relations: ['cargo', 'tipoContratacion', 'sexo', 'estadoCivil', 'municipio'],
    });

    if (!empleado) {
      throw new NotFoundException(`Empleado ${email} no encontrado`);
    }

    return empleado;
  }

  // =========================================================
  // CREAR EMPLEADO
  // =========================================================

  crear(dto: CrearEmpleadoDto) {
    const empleado = this.empleadoRepo.create(dto);

    return this.empleadoRepo.save(empleado);
  }

  // =========================================================
  // ACTUALIZAR EMPLEADO
  // =========================================================

  async actualizar(email: string, dto: ActualizarEmpleadoDto) {
    await this.findOne(email);

    await this.empleadoRepo.update(
      {
        emailInstitucional: email,
      },
      dto as Partial<Empleado>,
    );

    return this.findOne(email);
  }

  // =========================================================
  // HISTORIAL
  // =========================================================

  findHistorial(email: string) {
    return this.historialRepo.find({
      where: {
        emailInstitucional: email,
      },
    });
  }

  // =========================================================
  // HORAS DISPONIBLES
  // =========================================================

  findHorasDisponibles(email: string) {
    return this.horasRepo.find({
      where: {
        emailInstitucional: email,
      },
    });
  }

  // =========================================================
  // BUSCAR EMPLEADO ADMIN
  // =========================================================

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

  // =========================================================
  // OBTENER DATOS SEDH
  // =========================================================

  async obtenerDatosSedh() {
    try {
      const rows = await this.dataSource.query('SELECT rrhh.obtener_datos_sedh()');

      return rows[0]?.obtener_datos_sedh ?? null;
    } catch (error) {
      this.logger.error(`Error en obtenerDatosSedh: ${error}`);

      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }

  // =========================================================
  // VALIDAR JEFE INMEDIATO POR DEPENDENCIA
  // =========================================================

  private async validarJefeInmediatoPorDependencia(
    manager: EntityManager,
    emailEmpleado: string,
    idsRoles: number[],
  ): Promise<void> {
    // -------------------------------------------------------
    // ROL 2 = JEFE INMEDIATO
    //
    // Si no se está asignando el rol 2, no hay nada que
    // validar.
    // -------------------------------------------------------

    if (!idsRoles.includes(2)) {
      return;
    }

    const emailActual = emailEmpleado.toLowerCase().trim();

    // -------------------------------------------------------
    // OBTENER EMPLEADO Y DEPENDENCIA
    //
    // empleado -> cargo -> dependencia
    // -------------------------------------------------------

    const empleadoRows = await manager.query(
      `
          SELECT
            e.idusuario,
            e.emailinstitucional,
            e.idcargo,
            c.iddependencia,
            d.nomdependencia
          FROM rrhh.empleados e
          INNER JOIN rrhh.cargos c
            ON c.idcargo = e.idcargo
          LEFT JOIN rrhh.dependencias d
            ON d.iddependencia = c.iddependencia
          WHERE LOWER(
                  TRIM(e.emailinstitucional)
                ) =
                LOWER(
                  TRIM($1)
                )
          LIMIT 1
        `,
      [emailEmpleado],
    );

    const empleadoActual = empleadoRows?.[0];

    if (!empleadoActual) {
      throw new NotFoundException(`No se encontró información del empleado ${emailEmpleado}`);
    }

    if (empleadoActual.iddependencia === null || empleadoActual.iddependencia === undefined) {
      throw new BadRequestException('El empleado no tiene una dependencia asociada a su cargo');
    }

    const idDependencia = Number(empleadoActual.iddependencia);

    const nombreDependencia = empleadoActual.nomdependencia ?? `Dependencia ${idDependencia}`;

    // -------------------------------------------------------
    // OBTENER JEFES OFICIALES Y SUS DEPENDENCIAS
    // -------------------------------------------------------

    const placeholders = JEFES_INMEDIATOS_OFICIALES.map((_, index) => `$${index + 1}`).join(', ');

    const jefesOficialesRows = await manager.query(
      `
          SELECT
            LOWER(
              TRIM(e.emailinstitucional)
            ) AS emailinstitucional,
            c.iddependencia,
            d.nomdependencia
          FROM rrhh.empleados e
          INNER JOIN rrhh.cargos c
            ON c.idcargo = e.idcargo
          LEFT JOIN rrhh.dependencias d
            ON d.iddependencia = c.iddependencia
          WHERE LOWER(
                  TRIM(e.emailinstitucional)
                ) IN (${placeholders})
        `,
      JEFES_INMEDIATOS_OFICIALES,
    );

    // -------------------------------------------------------
    // BUSCAR EL JEFE OFICIAL DE LA DEPENDENCIA
    // -------------------------------------------------------

    const jefeOficial = jefesOficialesRows.find(
      (jefe) => Number(jefe.iddependencia) === idDependencia,
    );

    // -------------------------------------------------------
    // LA DEPENDENCIA NO TIENE JEFE DEFINIDO
    //
    // Ejemplo:
    // - Unidad de Compras
    // - Unidad de Implementación
    //
    // En estos casos se puede asignar un jefe.
    // -------------------------------------------------------

    if (!jefeOficial) {
      return;
    }

    const emailJefeOficial = String(jefeOficial.emailinstitucional).toLowerCase().trim();

    // -------------------------------------------------------
    // EL EMPLEADO ES EL MISMO JEFE OFICIAL
    //
    // Permitimos editarlo y guardar nuevamente sus roles.
    // -------------------------------------------------------

    if (emailActual === emailJefeOficial) {
      return;
    }

    // -------------------------------------------------------
    // OTRA PERSONA ESTÁ INTENTANDO ASUMIR ROL 2
    // -------------------------------------------------------

    throw new BadRequestException(
      `No se puede asignar el rol de Jefe Inmediato. ` +
        `La dependencia "${nombreDependencia}" ` +
        `ya tiene como Jefe Inmediato a ` +
        `${emailJefeOficial}.`,
    );
  }

  // =========================================================
  // ACTUALIZAR EMPLEADO ADMIN
  // =========================================================

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
        // -------------------------------------------------
        // ACTUALIZAR INFORMACIÓN DEL EMPLEADO
        // -------------------------------------------------

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

        // -------------------------------------------------
        // OBTENER ID DEL USUARIO
        // -------------------------------------------------

        const usuarios = await manager.query(
          `
                SELECT
                  u.idusuario
                FROM core.usuarios u
                WHERE LOWER(
                        TRIM(
                          u.emailinstitucional
                        )
                      ) =
                      LOWER(
                        TRIM($1)
                      )
                LIMIT 1
              `,
          [emailEmpleado],
        );

        const idUsuario = usuarios[0]?.idusuario;

        if (!idUsuario) {
          throw new NotFoundException(`No existe el usuario del sistema para ${emailEmpleado}`);
        }

        // -------------------------------------------------
        // OBTENER ROLES ÚNICOS
        // -------------------------------------------------

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

        // -------------------------------------------------
        // VALIDAR JEFE INMEDIATO
        //
        // Esta validación ocurre ANTES de eliminar los
        // roles actuales.
        // -------------------------------------------------

        await this.validarJefeInmediatoPorDependencia(manager, emailEmpleado, idsRoles);

        // -------------------------------------------------
        // ELIMINAR ROLES ACTUALES
        // -------------------------------------------------

        await manager.query(
          `
              DELETE FROM core.usuario_roles
              WHERE idusuario = $1::uuid
            `,
          [idUsuario],
        );

        // -------------------------------------------------
        // INSERTAR NUEVOS ROLES
        // -------------------------------------------------

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

        // -------------------------------------------------
        // RESPUESTA
        // -------------------------------------------------

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
  // =========================================================
  // VALIDAR JEFE INMEDIATO AL CREAR EMPLEADO
  //
  // ROL 2 = JEFE INMEDIATO
  //
  // Una dependencia no puede tener dos Jefes Inmediatos.
  // =========================================================

  private async validarJefeInmediatoAlCrear(
    manager: EntityManager,
    payload: {
      empleado: unknown;
      accesosSistema: Array<{
        idRol: number;
        idModulo: number;
      }>;
    },
  ): Promise<void> {
    // -------------------------------------------------------
    // ¿ESTÁ INTENTANDO ASIGNAR EL ROL 2?
    // -------------------------------------------------------

    const idsRoles = [
      ...new Set(
        (payload.accesosSistema ?? [])
          .map((acceso) => Number(acceso.idRol))
          .filter((idRol) => Number.isInteger(idRol) && idRol > 0),
      ),
    ];

    if (!idsRoles.includes(2)) {
      return;
    }

    // -------------------------------------------------------
    // OBTENER ID DEL CARGO
    // -------------------------------------------------------

    const empleadoPayload = payload.empleado as {
      idCargo?: number | string;
      idcargo?: number | string;
    };

    const idCargo = Number(empleadoPayload.idCargo ?? empleadoPayload.idcargo);

    if (!Number.isInteger(idCargo) || idCargo <= 0) {
      throw new BadRequestException(
        'No se pudo identificar el cargo del nuevo empleado para validar el Jefe Inmediato',
      );
    }

    // -------------------------------------------------------
    // OBTENER DEPENDENCIA DEL CARGO
    // -------------------------------------------------------

    const dependenciaRows = await manager.query(
      `
        SELECT
          c.iddependencia,
          d.nomdependencia
        FROM rrhh.cargos c
        LEFT JOIN rrhh.dependencias d
          ON d.iddependencia = c.iddependencia
        WHERE c.idcargo = $1::smallint
        LIMIT 1
      `,
      [idCargo],
    );

    const dependencia = dependenciaRows?.[0];

    if (!dependencia) {
      throw new NotFoundException('No se encontró el cargo seleccionado para el nuevo empleado');
    }

    if (dependencia.iddependencia === null || dependencia.iddependencia === undefined) {
      throw new BadRequestException('El cargo seleccionado no tiene una dependencia asociada');
    }

    // -------------------------------------------------------
    // BUSCAR SI YA EXISTE UN JEFE INMEDIATO
    // EN ESA DEPENDENCIA
    // -------------------------------------------------------

    const jefeRows = await manager.query(
      `
        SELECT
          e.prinombre,
          e.priapellido,
          e.emailinstitucional,
          d.nomdependencia
        FROM core.usuario_roles ur

        INNER JOIN core.usuarios u
          ON u.idusuario = ur.idusuario

        INNER JOIN rrhh.empleados e
          ON e.idusuario = u.idusuario

        INNER JOIN rrhh.cargos c
          ON c.idcargo = e.idcargo

        LEFT JOIN rrhh.dependencias d
          ON d.iddependencia = c.iddependencia

        WHERE
          ur.idrol = 2

          AND c.iddependencia =
              $1::smallint

          AND e.actlaboralmente = true

        LIMIT 1
      `,
      [dependencia.iddependencia],
    );

    const jefeExistente = jefeRows?.[0];

    if (!jefeExistente) {
      return;
    }

    const nombreJefe = [jefeExistente.prinombre, jefeExistente.priapellido]
      .filter(Boolean)
      .join(' ')
      .trim();

    const nombreDependencia =
      jefeExistente.nomdependencia ??
      dependencia.nomdependencia ??
      `Dependencia ${dependencia.iddependencia}`;

    throw new BadRequestException(
      `No se puede crear el empleado con el rol de Jefe Inmediato. ` +
        `La dependencia "${nombreDependencia}" ` +
        `ya tiene un Jefe Inmediato asignado` +
        `${nombreJefe ? `: ${nombreJefe}.` : '.'}`,
    );
  }

  // =========================================================
  // CREAR EMPLEADO ADMIN
  // =========================================================

  async crearEmpleadoAdmin(
    emailAdmin: string,
    rol: number,
    idmodulo: number,
    payload: {
      contrasena: string;
      empleado: unknown;
      accesosSistema: Array<{
        idRol: number;
        idModulo: number;
      }>;
    },
  ) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // ---------------------------------------------------
        // VALIDAR JEFE INMEDIATO ANTES DE CREAR
        // ---------------------------------------------------

        await this.validarJefeInmediatoAlCrear(manager, payload);

        // ---------------------------------------------------
        // CREAR EMPLEADO
        // ---------------------------------------------------

        const rows = await manager.query(
          `
              SELECT rrhh.crear_empleado(
                $1,
                $2,
                $3,
                $4
              )
            `,
          [emailAdmin, String(rol), String(idmodulo), JSON.stringify(payload)],
        );

        return rows[0]?.crear_empleado ?? null;
      });
    } catch (error: unknown) {
      this.logger.error(
        'Error en crearEmpleadoAdmin',
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'No se pudo crear el empleado',
      );
    }
  }
  // =========================================================
  // ACTUALIZAR HORAS DISPONIBLES
  // =========================================================

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

  // =========================================================
  // LISTAR EMPLEADOS
  // =========================================================

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
            { buscar: `%${busqueda}%` },
          )
            .orWhere(
              `
                LOWER(empleado.priApellido)
                LIKE LOWER(:buscar)
              `,
              { buscar: `%${busqueda}%` },
            )
            .orWhere(
              `
                LOWER(empleado.emailInstitucional)
                LIKE LOWER(:buscar)
              `,
              { buscar: `%${busqueda}%` },
            )
            .orWhere(
              `
                empleado.numIdentidad
                LIKE :buscar
              `,
              { buscar: `%${busqueda}%` },
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

  // =========================================================
  // VINCULAR USUARIO A EMPLEADO
  // =========================================================

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
        // -------------------------------------------------
        // BUSCAR USUARIO
        // -------------------------------------------------

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

        // -------------------------------------------------
        // VERIFICAR SI YA ESTÁ VINCULADO
        // -------------------------------------------------

        const empleadosExistentes = await manager.query(
          `
                SELECT
                  emailinstitucional
                FROM rrhh.empleados
                WHERE
                  idusuario = $1::uuid
                  OR LOWER(
                       TRIM(
                         emailinstitucional
                       )
                     ) =
                     LOWER(
                       TRIM($2)
                     )
                LIMIT 1
              `,
          [idUsuario, usuario.emailinstitucional],
        );

        if (empleadosExistentes?.length) {
          throw new BadRequestException('El usuario ya está vinculado a un empleado');
        }

        // -------------------------------------------------
        // CREAR EMPLEADO
        // -------------------------------------------------

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

            empleado.numTelefono?.trim() ?? null,

            empleado.idTipoContratacion,

            empleado.idCargo,

            empleado.idSupInmediato?.trim() ?? null,

            empleado.idSexo,

            empleado.idEstadoCivil,

            empleado.idMunicipio ?? null,

            emailAdmin,

            idUsuario,
          ],
        );

        // -------------------------------------------------
        // HORAS DISPONIBLES
        // -------------------------------------------------

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
                        TRIM(
                          emailinstitucional
                        )
                      ) =
                      LOWER(
                        TRIM($1)
                      )
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
