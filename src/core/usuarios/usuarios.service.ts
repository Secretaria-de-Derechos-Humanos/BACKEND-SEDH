import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

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
  // LISTAR USUARIOS CON ROLES
  // =========================================================

  async findAllWithRoles(): Promise<any[]> {
    const usuariosRaw = await this.repo.query(`
      SELECT
        u.idusuario,
        u.emailinstitucional,
        u.activo,
        r.idrol,
        r.nomrol
      FROM core.usuarios u
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
          activo: fila.activo === true,
          roles: [],
        };

        usuarios.push(usuario);
      }

      if (fila.idrol !== null && fila.idrol !== undefined) {
        usuario.roles.push({
          idRol: Number(fila.idrol),
          nomRol: fila.nomrol,
        });
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
  // OBTENER RESUMEN
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
          LIMIT 1
        `,
      [idUsuario],
    );

    const usuario = rows?.[0];

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      idUsuario: usuario.idusuario,

      emailInstitucional: usuario.emailinstitucional,

      priNombre: usuario.prinombre,

      segNombre: usuario.segnombre,

      priApellido: usuario.priapellido,

      segApellido: usuario.segapellido,

      activo: usuario.activo,

      idRol: usuario.idrol != null ? Number(usuario.idrol) : null,

      rol: usuario.nomrol ?? null,
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
            ON d.iddependencia = c.iddependencia
          WHERE e.idusuario = $1::uuid
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
  // VALIDAR JEFE INMEDIATO
  // =========================================================

  private async validarJefeInmediato(
    manager: any,
    idUsuario: string,
    idDependencia: number,
  ): Promise<void> {
    // -------------------------------------------------------
    // 1. Validar que la dependencia exista
    // -------------------------------------------------------

    const dependencia = await manager.query(
      `
          SELECT
            iddependencia,
            nomdependencia
          FROM rrhh.dependencias
          WHERE iddependencia = $1::smallint
          LIMIT 1
        `,
      [idDependencia],
    );

    if (!dependencia?.length) {
      throw new BadRequestException('La dependencia seleccionada no existe.');
    }

    // -------------------------------------------------------
    // 2. Obtener la dependencia REAL del empleado
    // -------------------------------------------------------

    const empleado = await manager.query(
      `
          SELECT
            e.idusuario,
            c.idcargo,
            c.iddependencia,
            d.nomdependencia
          FROM rrhh.empleados e
          INNER JOIN rrhh.cargos c
            ON c.idcargo = e.idcargo
          INNER JOIN rrhh.dependencias d
            ON d.iddependencia = c.iddependencia
          WHERE e.idusuario = $1::uuid
          LIMIT 1
        `,
      [idUsuario],
    );

    if (!empleado?.length) {
      throw new BadRequestException('El usuario no tiene un empleado o cargo asociado.');
    }

    const dependenciaActual = Number(empleado[0].iddependencia);

    // -------------------------------------------------------
    // 3. La dependencia seleccionada debe corresponder
    //    a la dependencia laboral del empleado.
    // -------------------------------------------------------

    if (dependenciaActual !== Number(idDependencia)) {
      throw new BadRequestException(
        `La dependencia seleccionada no corresponde a la dependencia laboral actual del empleado: ${empleado[0].nomdependencia}.`,
      );
    }

    // -------------------------------------------------------
    // 4. Evitar condiciones de carrera.
    //
    //    PostgreSQL bloquea esta dependencia durante
    //    la transacción actual.
    // -------------------------------------------------------

    await manager.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtext(
            'sedh-jefe-dependencia-' ||
            $1::text
          )
        )
      `,
      [idDependencia],
    );

    // -------------------------------------------------------
    // 5. Buscar otro usuario que ya tenga rol 2
    //    en esta misma dependencia.
    //
    //    Excluimos al usuario que estamos actualizando.
    // -------------------------------------------------------

    const jefeExistente = await manager.query(
      `
          SELECT
            u.idusuario,
            u.emailinstitucional,
            e.prinombre,
            e.priapellido,
            c.iddependencia,
            d.nomdependencia
          FROM core.usuarios u
          INNER JOIN core.usuario_roles ur
            ON ur.idusuario = u.idusuario
          INNER JOIN rrhh.empleados e
            ON e.idusuario = u.idusuario
          INNER JOIN rrhh.cargos c
            ON c.idcargo = e.idcargo
          INNER JOIN rrhh.dependencias d
            ON d.iddependencia = c.iddependencia
          WHERE ur.idrol = 2
            AND c.iddependencia = $1::smallint
            AND u.idusuario <> $2::uuid
            AND COALESCE(u.activo, FALSE) = TRUE
          LIMIT 1
        `,
      [idDependencia, idUsuario],
    );

    if (jefeExistente?.length) {
      const jefe = jefeExistente[0];

      const nombre = [jefe.prinombre, jefe.priapellido].filter(Boolean).join(' ').trim();

      throw new ConflictException(
        `La dependencia "${jefe.nomdependencia}" ya tiene un Jefe Inmediato asignado${nombre ? `: ${nombre}` : ''}.`,
      );
    }
  }

  // =========================================================
  // ACTUALIZAR USUARIO
  // =========================================================

  async actualizar(idUsuario: string, dto: ActualizarUsuarioDto): Promise<Usuario> {
    return this.dataSource.transaction(async (manager) => {
      const repoUsuario = manager.getRepository(Usuario);

      // ---------------------------------------------------
      // Buscar usuario
      // ---------------------------------------------------

      const usuario = await repoUsuario.findOne({
        where: {
          idUsuario,
        },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // ---------------------------------------------------
      // Si se está asignando Jefe Inmediato,
      // validar dependencia.
      // ---------------------------------------------------

      const rolesSolicitados = dto.idRoles?.map((id) => Number(id)) ?? undefined;

      if (rolesSolicitados?.includes(2)) {
        if (dto.idDependencia === undefined || dto.idDependencia === null) {
          throw new BadRequestException(
            'Debe seleccionar una dependencia para asignar el rol de Jefe Inmediato.',
          );
        }

        await this.validarJefeInmediato(manager, idUsuario, Number(dto.idDependencia));
      }

      // ---------------------------------------------------
      // ACTIVO / INACTIVO
      // ---------------------------------------------------

      if (dto.activo !== undefined) {
        usuario.activo = dto.activo;
      }

      // ---------------------------------------------------
      // CONTRASEÑA
      // ---------------------------------------------------

      if (dto.contrasena) {
        usuario.contrasena = await bcrypt.hash(dto.contrasena, 12);
      }

      // ---------------------------------------------------
      // ACTUALIZADO POR
      // ---------------------------------------------------

      if (dto.actualizadoPor) {
        usuario.actualizadoPor = dto.actualizadoPor;
      }

      usuario.actualizadoEn = new Date();

      await repoUsuario.save(usuario);

      // ---------------------------------------------------
      // CAMBIO DE ROL
      // ---------------------------------------------------

      if (rolesSolicitados !== undefined) {
        if (!rolesSolicitados.length) {
          throw new BadRequestException('Debe seleccionar al menos un rol para el usuario.');
        }

        const rolesUnicos = [...new Set(rolesSolicitados)];

        const rolesExistentes = await manager.query(
          `
            SELECT idrol
            FROM core.roles
            WHERE idrol = ANY($1::integer[])
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

        await manager.query(
          `
            DELETE FROM core.usuario_roles
            WHERE idusuario = $1::uuid
          `,
          [idUsuario],
        );

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
  // ÚLTIMO ACCESO
  // =========================================================

  async actualizarUltimoAcceso(idUsuario: string): Promise<void> {
    await this.repo.update(
      {
        idUsuario,
      },
      {
        ultimoAcceso: new Date(),
      },
    );
  }

  // =========================================================
  // HEATMAP
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
  // RESET PASSWORD
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
  // PASSWORD TEMPORAL
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
  ): Promise<{
    message: string;
  }> {
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
          WHERE idusuario = $2::uuid
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
            actualizadoen = CURRENT_DATE
          WHERE idusuario = $2::uuid
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
