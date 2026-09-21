import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { Usuario } from './entities/usuario.entity';

export interface CrearUsuarioResultado {
  idUsuario: string;
  emailInstitucional: string;
  priNombre: string;
  segNombre: string | null;
  priApellido: string;
  segApellido: string | null;
  idRol: number;
  debeCambiarPassword: boolean;
  message: string;
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly repo: Repository<Usuario>,

    private readonly dataSource: DataSource,
  ) {}

  // =========================================================
  // LISTAR USUARIOS CON TODOS SUS ROLES
  // =========================================================

  async findAllWithRoles(): Promise<any[]> {
    const usuariosRaw = await this.repo.query(`
    SELECT
      u.idusuario,
      u.emailinstitucional,

      COALESCE(
        NULLIF(TRIM(u.prinombre), ''),
        NULLIF(TRIM(e.prinombre), '')
      ) AS prinombre,

      COALESCE(
        NULLIF(TRIM(u.segnombre), ''),
        NULLIF(TRIM(e.segnombre), '')
      ) AS segnombre,

      COALESCE(
        NULLIF(TRIM(u.priapellido), ''),
        NULLIF(TRIM(e.priapellido), '')
      ) AS priapellido,

      COALESCE(
        NULLIF(TRIM(u.segapellido), ''),
        NULLIF(TRIM(e.segapellido), '')
      ) AS segapellido,

      u.activo,
      r.idrol,
      r.nomrol

    FROM core.usuarios u

    LEFT JOIN rrhh.empleados e
      ON e.idusuario = u.idusuario

    LEFT JOIN core.usuario_roles ur
      ON u.idusuario = ur.idusuario

    LEFT JOIN core.roles r
      ON ur.idrol = r.idrol

    ORDER BY u.emailinstitucional ASC
  `);

    const resultado = usuariosRaw.reduce((usuarios: any[], fila: any) => {
      let usuario = usuarios.find((item) => item.idusuario === fila.idusuario);

      if (!usuario) {
        usuario = {
          idUsuario: fila.idusuario,

          emailInstitucional: fila.emailinstitucional,

          nombre: [fila.prinombre, fila.segnombre, fila.priapellido, fila.segapellido]
            .filter(Boolean)
            .join(' ')
            .trim(),

          activo: fila.activo === true,

          roles: [],
        };

        usuarios.push(usuario);
      }

      if (fila.idrol !== null && fila.idrol !== undefined) {
        const yaExiste = usuario.roles.some((rol: any) => Number(rol.idRol) === Number(fila.idrol));

        if (!yaExiste) {
          usuario.roles.push({
            idRol: Number(fila.idrol),
            nomRol: fila.nomrol,
          });
        }
      }

      return usuarios;
    }, []);

    return resultado;
  }

  // =========================================================
  // BUSCAR POR ID
  // =========================================================

  async findById(idUsuario: string): Promise<Usuario> {
    const usuario = await this.repo.findOne({
      where: {
        idUsuario,
      },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  // =========================================================
  // BUSCAR POR EMAIL
  // =========================================================

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.repo.findOne({
      where: {
        emailInstitucional: email,
      },
    });
  }

  // =========================================================
  // CREAR USUARIO
  // =========================================================

  async crear(dto: CrearUsuarioDto): Promise<CrearUsuarioResultado> {
    const email = dto.emailInstitucional.trim().toLowerCase();

    return this.dataSource.transaction(async (manager) => {
      const repoUsuario = manager.getRepository(Usuario);

      const existe = await repoUsuario.findOne({
        where: {
          emailInstitucional: email,
        },
      });

      if (existe) {
        throw new ConflictException('El correo institucional ya está registrado');
      }

      const rolExiste = await manager.query(
        `
          SELECT
            idrol,
            nomrol
          FROM core.roles
          WHERE idrol = $1::integer
          LIMIT 1
        `,
        [dto.idRol],
      );

      if (!rolExiste?.length) {
        throw new BadRequestException(`No existe el rol con id ${dto.idRol}`);
      }

      const hash = await bcrypt.hash(dto.contrasena, 12);

      const usuario = repoUsuario.create({
        emailInstitucional: email,

        priNombre: dto.priNombre.trim().toUpperCase(),

        segNombre: dto.segNombre?.trim() ? dto.segNombre.trim().toUpperCase() : null,

        priApellido: dto.priApellido.trim().toUpperCase(),

        segApellido: dto.segApellido?.trim() ? dto.segApellido.trim().toUpperCase() : null,

        contrasena: hash,

        activo: true,

        debeCambiarPassword: true,

        creadoPor: dto.creadoPor?.trim() || null,

        creadoEn: new Date(),
      });

      const usuarioGuardado = await repoUsuario.save(usuario);

      await manager.query(
        `
          INSERT INTO core.usuario_roles (
            idusuario,
            idrol
          )
          VALUES (
            $1::uuid,
            $2::integer
          )
        `,
        [usuarioGuardado.idUsuario, dto.idRol],
      );

      return {
        idUsuario: usuarioGuardado.idUsuario,

        emailInstitucional: usuarioGuardado.emailInstitucional,

        priNombre: usuarioGuardado.priNombre ?? '',

        segNombre: usuarioGuardado.segNombre,

        priApellido: usuarioGuardado.priApellido ?? '',

        segApellido: usuarioGuardado.segApellido,

        idRol: Number(dto.idRol),

        debeCambiarPassword: true,

        message: 'Usuario creado correctamente',
      };
    });
  }

  // =========================================================
  // OBTENER RESUMEN DEL USUARIO
  // =========================================================

  async obtenerResumenUsuario(idUsuario: string) {
    const rows = await this.dataSource.query(
      `
        SELECT
          u.idusuario,
          u.emailinstitucional,
          u.prinombre,
          u.segnombre,
          u.priapellido,
          u.segapellido,
          u.activo,
          r.idrol,
          r.nomrol
        FROM core.usuarios u

        LEFT JOIN core.usuario_roles ur
          ON ur.idusuario = u.idusuario

        LEFT JOIN core.roles r
          ON r.idrol = ur.idrol

        WHERE u.idusuario = $1::uuid

        ORDER BY r.idrol
      `,
      [idUsuario],
    );

    if (!rows?.length) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const usuario = rows[0];

    const roles = rows
      .filter((row: any) => row.idrol !== null && row.idrol !== undefined)
      .map((row: any) => ({
        idRol: Number(row.idrol),
        nomRol: row.nomrol,
      }));

    return {
      idUsuario: usuario.idusuario,

      emailInstitucional: usuario.emailinstitucional,

      priNombre: usuario.prinombre,

      segNombre: usuario.segnombre,

      priApellido: usuario.priapellido,

      segApellido: usuario.segapellido,

      activo: usuario.activo,

      // Se mantiene para compatibilidad
      // con el frontend actual.
      idRol: roles.length > 0 ? roles[0].idRol : null,

      rol: roles.length > 0 ? roles[0].nomRol : null,

      // Nuevos campos para múltiples roles.
      idRoles: roles.map((rol: any) => rol.idRol),

      roles,
    };
  }

  // =========================================================
  // LISTAR TODOS
  // =========================================================

  async listarTodos(): Promise<Usuario[]> {
    return this.repo.find({
      order: {
        emailInstitucional: 'ASC',
      },
    });
  }
  // =========================================================
  // LISTAR TODAS LAS DEPENDENCIAS
  // =========================================================

  async listarDependencias() {
    const rows = await this.dataSource.query(`
    SELECT
      d.iddependencia,
      d.nomdependencia
    FROM rrhh.dependencias d
    ORDER BY d.nomdependencia ASC
  `);

    return {
      success: true,

      data: rows.map((dependencia: any) => ({
        idDependencia: Number(dependencia.iddependencia),
        nomDependencia: dependencia.nomdependencia,
      })),

      message: 'Dependencias obtenidas correctamente.',
    };
  }

  // =========================================================
  // OBTENER DEPENDENCIA DEL USUARIO
  // =========================================================

  async obtenerDependenciaUsuario(idUsuario: string) {
    const rows = await this.dataSource.query(
      `
        SELECT
          e.idusuario,
          c.idcargo,
          c.nomcargo,
          d.iddependencia,
          d.nomdependencia
        FROM rrhh.empleados e

        INNER JOIN rrhh.cargos c
          ON c.idcargo = e.idcargo

        INNER JOIN rrhh.dependencias d
          ON d.iddependencia =
             c.iddependencia

        WHERE e.idusuario =
              $1::uuid

        LIMIT 1
      `,
      [idUsuario],
    );

    if (!rows?.length) {
      return {
        success: false,
        data: null,
        message: 'El usuario no tiene un empleado o cargo asociado.',
      };
    }

    return {
      success: true,

      data: {
        idDependencia: Number(rows[0].iddependencia),

        nomDependencia: rows[0].nomdependencia,

        idCargo: Number(rows[0].idcargo),

        nomCargo: rows[0].nomcargo,
      },

      message: 'Dependencia obtenida correctamente.',
    };
  }

  // =========================================================
  // ACTUALIZAR USUARIO
  // =========================================================

  async actualizar(idUsuario: string, dto: ActualizarUsuarioDto): Promise<Usuario> {
    return this.dataSource.transaction(async (manager) => {
      const repoUsuario = manager.getRepository(Usuario);

      const usuario = await repoUsuario.findOne({
        where: {
          idUsuario,
        },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // =====================================================
      // PREPARAR ROLES
      // =====================================================

      const rolesSolicitados =
        dto.idRoles !== undefined ? dto.idRoles.map((id) => Number(id)) : undefined;

      // =====================================================
      // VALIDAR AL MENOS UN ROL
      // =====================================================

      if (rolesSolicitados !== undefined && rolesSolicitados.length === 0) {
        throw new BadRequestException('Debe seleccionar al menos un rol para el usuario.');
      }

      // =====================================================
      // ELIMINAR ROLES DUPLICADOS
      // =====================================================

      const rolesUnicos =
        rolesSolicitados !== undefined ? [...new Set(rolesSolicitados)] : undefined;

      // =====================================================
      // VALIDAR QUE TODOS LOS ROLES EXISTAN
      // =====================================================

      if (rolesUnicos !== undefined) {
        const rolesExistentes = await manager.query(
          `
              SELECT idrol
              FROM core.roles
              WHERE idrol =
                    ANY($1::integer[])
            `,
          [rolesUnicos],
        );

        const idsExistentes = new Set(rolesExistentes.map((rol: any) => Number(rol.idrol)));

        const rolesInvalidos = rolesUnicos.filter((idRol) => !idsExistentes.has(idRol));

        if (rolesInvalidos.length) {
          throw new BadRequestException(
            `No existe(n) el/los rol(es): ${rolesInvalidos.join(', ')}.`,
          );
        }
      }

      // =====================================================
      // VALIDAR JEFE INMEDIATO
      // ROL 2
      // =====================================================

      if (rolesUnicos?.includes(2)) {
        if (dto.idDependencia === undefined || dto.idDependencia === null) {
          throw new BadRequestException(
            'Debe seleccionar una dependencia para asignar el rol de Jefe Inmediato.',
          );
        }

        await this.validarJefeInmediato(manager, idUsuario, Number(dto.idDependencia));
      }

      // =====================================================
      // ACTUALIZAR DATOS DEL USUARIO
      // =====================================================

      if (dto.activo !== undefined) {
        usuario.activo = dto.activo;
      }

      if (dto.contrasena) {
        usuario.contrasena = await bcrypt.hash(dto.contrasena, 12);
      }

      if (dto.actualizadoPor) {
        usuario.actualizadoPor = dto.actualizadoPor;
      }

      usuario.actualizadoEn = new Date();

      await repoUsuario.save(usuario);

      // =====================================================
      // ACTUALIZAR ROLES
      // =====================================================

      if (rolesUnicos !== undefined) {
        // Eliminar roles actuales
        await manager.query(
          `
            DELETE FROM core.usuario_roles
            WHERE idusuario =
                  $1::uuid
          `,
          [idUsuario],
        );

        // Insertar todos los roles seleccionados
        for (const idRol of rolesUnicos) {
          await manager.query(
            `
              INSERT INTO core.usuario_roles (
                idusuario,
                idrol
              )
              VALUES (
                $1::uuid,
                $2::integer
              )
            `,
            [idUsuario, idRol],
          );
        }
      }

      return usuario;
    });
  }

  // =========================================================
  // VALIDAR JEFE INMEDIATO
  // =========================================================

  private async validarJefeInmediato(
    manager: EntityManager,
    idUsuario: string,
    idDependencia: number,
  ): Promise<void> {
    // -------------------------------------------------
    // OBTENER DEPENDENCIA ACTUAL DEL EMPLEADO
    // -------------------------------------------------

    const dependenciaUsuario = await manager.query(
      `
          SELECT
            c.iddependencia
          FROM rrhh.empleados e

          INNER JOIN rrhh.cargos c
            ON c.idcargo = e.idcargo

          WHERE e.idusuario = $1::uuid

          LIMIT 1
        `,
      [idUsuario],
    );

    if (!dependenciaUsuario?.length) {
      throw new BadRequestException('El usuario no tiene una dependencia asociada.');
    }

    const dependenciaActual = Number(dependenciaUsuario[0].iddependencia);

    // -------------------------------------------------
    // VALIDAR QUE LA DEPENDENCIA SELECCIONADA
    // CORRESPONDA AL EMPLEADO
    // -------------------------------------------------

    if (dependenciaActual !== Number(idDependencia)) {
      throw new BadRequestException(
        'La dependencia seleccionada no corresponde a la dependencia actual del usuario.',
      );
    }

    // -------------------------------------------------
    // BUSCAR SI YA EXISTE OTRO JEFE INMEDIATO
    // ACTIVO EN ESA DEPENDENCIA
    // -------------------------------------------------

    const jefeExistente = await manager.query(
      `
          SELECT
            ur.idusuario
          FROM core.usuario_roles ur

          INNER JOIN core.usuarios u
            ON u.idusuario =
               ur.idusuario

          INNER JOIN rrhh.empleados e
            ON e.idusuario =
               u.idusuario

          INNER JOIN rrhh.cargos c
            ON c.idcargo =
               e.idcargo

          WHERE ur.idrol = 2

            AND c.iddependencia =
                $1::integer

            AND u.activo = true

            AND ur.idusuario <>
                $2::uuid

          LIMIT 1
        `,
      [idDependencia, idUsuario],
    );

    if (jefeExistente?.length) {
      throw new ConflictException(
        'Ya existe un Jefe Inmediato activo para la dependencia seleccionada.',
      );
    }
  }

  // =========================================================
  // ACTUALIZAR ÚLTIMO ACCESO
  // =========================================================

  async actualizarUltimoAcceso(idUsuario: string): Promise<void> {
    await this.repo.update(
      { idUsuario },
      {
        ultimoAcceso: new Date(),
      },
    );
  }

  // =========================================================
  // HEATMAP DE ACTIVIDADES
  // =========================================================

  async obtenerHeatmapActividades(email: string): Promise<unknown> {
    const result = await this.dataSource.query(
      `
          SELECT
            core.obtener_heatmap_actividades_usuario($1)
        `,
      [email],
    );

    return result[0]['obtener_heatmap_actividades_usuario'];
  }

  // =========================================================
  // RESTABLECER PASSWORD
  // =========================================================

  async resetPassword(idUsuario: string): Promise<{
    message: string;
    passwordTemporal: string;
  }> {
    const usuario = await this.findById(idUsuario);

    const passwordTemporal = 'UnaPasswordNueva123';

    usuario.contrasena = await bcrypt.hash(passwordTemporal, 12);

    usuario.actualizadoEn = new Date();

    await this.repo.save(usuario);

    return {
      message: 'Contraseña restablecida correctamente',

      passwordTemporal,
    };
  }

  // =========================================================
  // ASIGNAR PASSWORD TEMPORAL
  // =========================================================

  async asignarPasswordTemporal(idUsuario: string, nuevaPassword: string) {
    const passwordLimpia = nuevaPassword?.trim();

    if (!passwordLimpia || passwordLimpia.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    const resultado = await this.dataSource.query(
      `
          UPDATE core.usuarios
          SET
            contrasena = crypt(
              $2::text,
              gen_salt('bf', 12)
            ),

            debecambiarpassword = TRUE,

            actualizadoen = NOW()

          WHERE idusuario = $1::uuid

          RETURNING
            idusuario,
            emailinstitucional,
            debecambiarpassword
        `,
      [idUsuario, passwordLimpia],
    );

    const usuarioActualizado = resultado?.[0];

    if (!usuarioActualizado) {
      throw new NotFoundException('No se encontró el usuario');
    }

    return {
      message: 'Contraseña temporal asignada correctamente',

      debeCambiarPassword: usuarioActualizado.debecambiarpassword,
    };
  }

  // =========================================================
  // CAMBIAR PASSWORD
  // =========================================================

  async cambiarPassword(
    idUsuario: string,
    passwordActual: string,
    nuevaPassword: string,
  ): Promise<{ message: string }> {
    if (passwordActual === nuevaPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente de la contraseña temporal',
      );
    }

    const validacion = await this.dataSource.query(
      `
          SELECT
            crypt(
              $1::text,
              contrasena
            ) = contrasena AS valida

          FROM core.usuarios

          WHERE idusuario =
                $2::uuid

            AND activo = TRUE
        `,
      [passwordActual, idUsuario],
    );

    if (!validacion?.[0]?.valida) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    const resultado = await this.dataSource.query(
      `
          UPDATE core.usuarios
          SET
            contrasena = crypt(
              $1::text,
              gen_salt('bf', 12)
            ),

            debecambiarpassword = FALSE,

            actualizadoen =
              CURRENT_DATE

          WHERE idusuario =
                $2::uuid

          RETURNING idusuario
        `,
      [nuevaPassword, idUsuario],
    );

    if (!resultado?.length) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      message: 'Contraseña actualizada correctamente',
    };
  }
}
