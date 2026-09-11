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

  // ============================================================
  // LISTAR USUARIOS CON ROLES Y NOMBRE COMPLETO
  // ============================================================

  async findAllWithRoles(): Promise<any[]> {
    const usuariosRaw = await this.repo.query(`
    SELECT
      u.idusuario,
      u.emailinstitucional,

      -- Nombre desde core.usuarios
      -- Si no existe, se toma desde rrhh.empleados
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

    -- Buscar el empleado relacionado por correo
    LEFT JOIN rrhh.empleados e
      ON LOWER(TRIM(e.emailinstitucional))
       = LOWER(TRIM(u.emailinstitucional))

    LEFT JOIN core.usuario_roles ur
      ON u.idusuario = ur.idusuario

    LEFT JOIN core.roles r
      ON ur.idrol = r.idrol

    ORDER BY u.emailinstitucional ASC
  `);

    const resultado = usuariosRaw.reduce((usuarios: any[], fila: any) => {
      let usuario = usuarios.find((item) => item.idUsuario === fila.idusuario);

      if (!usuario) {
        const nombreCompleto = [fila.prinombre, fila.segnombre, fila.priapellido, fila.segapellido]
          .filter((valor) => valor !== null && valor !== undefined && String(valor).trim() !== '')
          .map((valor) => String(valor).trim())
          .join(' ')
          .trim();

        usuario = {
          idUsuario: fila.idusuario,

          emailInstitucional: fila.emailinstitucional,

          nombre: nombreCompleto || null,

          activo: fila.activo === true,

          roles: [],
        };

        usuarios.push(usuario);
      }

      // ========================================================
      // AGREGAR ROLES
      // ========================================================

      if (fila.idrol !== null && fila.idrol !== undefined) {
        const rolExiste = usuario.roles.some(
          (rol: any) => Number(rol.idRol) === Number(fila.idrol),
        );

        if (!rolExiste) {
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

  // ============================================================
  // BUSCAR USUARIO POR ID
  // ============================================================

  async findById(idUsuario: string): Promise<Usuario> {
    const usuario = await this.repo.findOne({
      where: { idUsuario },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  // ============================================================
  // BUSCAR USUARIO POR EMAIL
  // ============================================================

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.repo.findOne({
      where: {
        emailInstitucional: email,
      },
    });
  }

  // ============================================================
  // CREAR USUARIO
  // ============================================================

  async crear(dto: CrearUsuarioDto): Promise<CrearUsuarioResultado> {
    const email = dto.emailInstitucional.trim().toLowerCase();

    return this.dataSource.transaction(async (manager) => {
      const repoUsuario = manager.getRepository(Usuario);

      // Verificar correo
      const existe = await repoUsuario.findOne({
        where: {
          emailInstitucional: email,
        },
      });

      if (existe) {
        throw new ConflictException('El correo institucional ya está registrado');
      }

      // Verificar rol
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

      // Encriptar contraseña
      const hash = await bcrypt.hash(dto.contrasena, 12);

      // Crear usuario
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

      // Asignar rol
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

        segApellido: usuarioGuardado.segApellido ?? usuarioGuardado.segApellido,

        idRol: Number(dto.idRol),

        debeCambiarPassword: true,

        message: 'Usuario creado correctamente',
      };
    });
  }

  // ============================================================
  // RESUMEN DE USUARIO
  // ============================================================

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

      nombre: [usuario.prinombre, usuario.segnombre, usuario.priapellido, usuario.segapellido]
        .filter(Boolean)
        .join(' ')
        .trim(),

      activo: usuario.activo,

      idRol: usuario.idrol != null ? Number(usuario.idrol) : null,

      rol: usuario.nomrol ?? null,
    };
  }

  // ============================================================
  // LISTAR TODOS
  // ============================================================

  async listarTodos(): Promise<Usuario[]> {
    return this.repo.find({
      order: {
        emailInstitucional: 'ASC',
      },
    });
  }

  // ============================================================
  // ACTUALIZAR USUARIO
  // ============================================================

  async actualizar(idUsuario: string, dto: ActualizarUsuarioDto): Promise<Usuario> {
    return this.dataSource.transaction(async (manager) => {
      const repoUsuario = manager.getRepository(Usuario);

      const usuario = await repoUsuario.findOne({
        where: { idUsuario },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // ==========================================================
      // ACTUALIZAR ESTADO
      // ==========================================================

      if (dto.activo !== undefined) {
        usuario.activo = dto.activo;
      }

      // ==========================================================
      // ACTUALIZAR CONTRASEÑA
      // ==========================================================

      if (dto.contrasena) {
        usuario.contrasena = await bcrypt.hash(dto.contrasena, 12);
      }

      // ==========================================================
      // USUARIO QUE REALIZA LA ACTUALIZACIÓN
      // ==========================================================

      if (dto.actualizadoPor) {
        usuario.actualizadoPor = dto.actualizadoPor;
      }

      usuario.actualizadoEn = new Date();

      await repoUsuario.save(usuario);

      // ==========================================================
      // ACTUALIZAR ROL
      // ==========================================================
      // El ActualizarUsuarioDto utiliza:
      // idRol?: number
      //
      // Por lo tanto NO debemos utilizar:
      // dto.idRoles.length
      // dto.idRoles.filter()
      // for (const idRol of dto.idRoles)
      // ==========================================================

      if (dto.idRol !== undefined) {
        // Verificar que el rol exista
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

        // Eliminar el rol actual
        await manager.query(
          `
          DELETE FROM core.usuario_roles
          WHERE idusuario = $1::uuid
        `,
          [idUsuario],
        );

        // Insertar el nuevo rol
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
          [idUsuario, dto.idRol],
        );
      }

      return usuario;
    });
  }
  // ============================================================
  // LISTAR DEPENDENCIAS
  // ============================================================

  async listarDependencias() {
    const dependencias = await this.dataSource.query(
      `
        SELECT
          d.iddependencia,
          d.nomdependencia
        FROM rrhh.dependencias d
        ORDER BY d.nomdependencia ASC
      `,
    );

    return dependencias.map((dependencia: any) => ({
      idDependencia: Number(dependencia.iddependencia),
      nomDependencia: dependencia.nomdependencia,
    }));
  }

  // ============================================================
  // OBTENER DEPENDENCIA DEL USUARIO
  // ============================================================

  async obtenerDependenciaUsuario(idUsuario: string) {
    const resultado = await this.dataSource.query(
      `
        SELECT
          u.idusuario,
          e.emailinstitucional,
          c.idcargo,
          c.nomcargo,
          d.iddependencia,
          d.nomdependencia
        FROM core.usuarios u

        INNER JOIN rrhh.empleados e
          ON e.idusuario = u.idusuario

        INNER JOIN rrhh.cargos c
          ON c.idcargo = e.idcargo

        LEFT JOIN rrhh.dependencias d
          ON d.iddependencia = c.iddependencia

        WHERE u.idusuario = $1::uuid

        LIMIT 1
      `,
      [idUsuario],
    );

    const usuario = resultado?.[0];

    if (!usuario) {
      throw new NotFoundException('El usuario no está vinculado a un empleado');
    }

    if (usuario.iddependencia === null || usuario.iddependencia === undefined) {
      throw new BadRequestException('El usuario no tiene una dependencia asociada a su cargo');
    }

    return {
      idUsuario: usuario.idusuario,
      emailInstitucional: usuario.emailinstitucional,
      idCargo:
        usuario.idcargo !== null && usuario.idcargo !== undefined ? Number(usuario.idcargo) : null,
      nomCargo: usuario.nomcargo ?? null,
      idDependencia: Number(usuario.iddependencia),
      nomDependencia: usuario.nomdependencia ?? null,
    };
  }
  // ============================================================
  // ACTUALIZAR ÚLTIMO ACCESO
  // ============================================================

  async actualizarUltimoAcceso(idUsuario: string): Promise<void> {
    await this.repo.update(
      { idUsuario },
      {
        ultimoAcceso: new Date(),
      },
    );
  }

  // ============================================================
  // HEATMAP DE ACTIVIDADES
  // ============================================================

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

  // ============================================================
  // RESTABLECER CONTRASEÑA
  // ============================================================

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

  // ============================================================
  // ASIGNAR CONTRASEÑA TEMPORAL
  // ============================================================

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

  // ============================================================
  // CAMBIAR CONTRASEÑA
  // ============================================================

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
