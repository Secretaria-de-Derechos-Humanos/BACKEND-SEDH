import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { Usuario } from './entities/usuario.entity';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

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
  async findById(idUsuario: string): Promise<Usuario> {
    const usuario = await this.repo.findOne({
      where: { idUsuario },
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return usuario;
  }
  async findByEmail(email: string): Promise<Usuario | null> {
    return this.repo.findOne({
      where: { emailInstitucional: email },
    });
  }

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

  async listarTodos(): Promise<Usuario[]> {
    return this.repo.find({
      order: {
        emailInstitucional: 'ASC',
      },
    });
  }

  async actualizar(idUsuario: string, dto: ActualizarUsuarioDto): Promise<Usuario> {
    return this.dataSource.transaction(async (manager) => {
      const repoUsuario = manager.getRepository(Usuario);

      const usuario = await repoUsuario.findOne({
        where: { idUsuario },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }
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
      if (dto.idRol !== undefined) {
        await manager.query(
          `
          DELETE FROM core.usuario_roles
          WHERE idusuario = $1
          `,
          [idUsuario],
        );
        await manager.query(
          `
          INSERT INTO core.usuario_roles (
            idusuario,
            idrol
          )
          VALUES ($1, $2)
          `,
          [idUsuario, dto.idRol],
        );
      }
      return usuario;
    });
  }

  async actualizarUltimoAcceso(idUsuario: string): Promise<void> {
    await this.repo.update({ idUsuario }, { ultimoAcceso: new Date() });
  }

  async obtenerHeatmapActividades(email: string): Promise<unknown> {
    const result = await this.dataSource.query(
      `SELECT core.obtener_heatmap_actividades_usuario($1)`,
      [email],
    );
    return result[0]['obtener_heatmap_actividades_usuario'];
  }
  async resetPassword(idUsuario: string): Promise<{ message: string; passwordTemporal: string }> {
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
      crypt($1::text, contrasena) = contrasena AS valida
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
      contrasena = crypt($1::text, gen_salt('bf', 12)),
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
