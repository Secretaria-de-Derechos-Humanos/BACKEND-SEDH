import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RefreshToken } from './entities/refresh-token.entity';

export interface RolLogin {
  r: number;
  m: number[];
}

export interface InstitucionInfo {
  nombre: string;
  apellido: string;
  puesto: string;
  dependencia: string;
  fechaIngreso: string;
}

export interface LoginFnResult {
  status: string;
  usuario: { id: string; email: string; telefono: string };
  institucionalInfo: InstitucionInfo;
  roles: RolLogin[];
}

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
}

interface UsuarioRefreshRow {
  idusuario: string;
  emailinstitucional: string;
  activo: boolean | null;
  numtelefono: string | null;
  prinombre: string | null;
  priapellido: string | null;
  fecinglaborar: Date | string | null;
  nomcargo: string | null;
  nomdependencia: string | null;
}

interface RolRefreshRow {
  idrol: number | string;
  modulos: Array<number | string> | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(dto: LoginDto): Promise<TokensResponse> {
    let result: any[];
    try {
      result = await this.dataSource.query(`SELECT core.login($1, $2) AS resultado`, [
        dto.email,
        dto.contrasena,
      ]);
    } catch (err) {
      this.logger.error('Error al llamar core.login():', err);
      throw new InternalServerErrorException();
    }

    const datos: LoginFnResult = result[0]?.resultado;

    if (!datos || datos.status !== 'OK') {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    try {
      return await this.emitirTokens(datos);
    } catch (err) {
      this.logger.error('Error al emitir tokens:', err);
      throw new InternalServerErrorException();
    }
  }

  // ── Refresh ────────────────────────────────────────────────────────────────
  async refresh(refreshTokenRaw: string): Promise<TokensResponse> {
    try {
      let payload: { sub: string; jti: string; tipo: string };
      try {
        payload = this.jwtService.verify(refreshTokenRaw, {
          algorithms: ['RS256'],
          issuer: this.config.get<string>('jwt.issuer'),
          audience: this.config.get<string>('jwt.audience'),
        });
      } catch {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }

      if (payload.tipo !== 'refresh') {
        throw new UnauthorizedException('Tipo de token incorrecto');
      }

      const tokenHash = this.hashToken(refreshTokenRaw);
      const stored = await this.refreshRepo.findOne({
        where: { jti: payload.jti },
      });

      if (!stored) {
        this.logger.warn(`[refresh] No se encontró registro en BD para jti=${payload.jti}`);
        throw new UnauthorizedException('Refresh token inválido o revocado');
      }
      if (stored.revocado) {
        this.logger.warn(`[refresh] Token ya revocado para jti=${payload.jti}`);
        throw new UnauthorizedException('Refresh token inválido o revocado');
      }
      if (stored.tokenHash !== tokenHash) {
        this.logger.warn(`[refresh] Hash no coincide para jti=${payload.jti}`);
        throw new UnauthorizedException('Refresh token inválido o revocado');
      }
      if (stored.expiracion < new Date()) {
        this.logger.warn(
          `[refresh] Token expirado en BD para jti=${payload.jti}, expiracion=${stored.expiracion.toISOString()}`,
        );
        throw new UnauthorizedException('Refresh token inválido o revocado');
      }

      // Rotación: revocar el token actual
      await this.refreshRepo.update({ jti: payload.jti }, { revocado: true });

      // Obtener datos actualizados del usuario desde la BD sin depender de funciones SQL
      let datos: LoginFnResult;
      try {
        datos = await this.obtenerDatosParaRefresh(stored.emailInstitucional);
      } catch (err) {
        this.logger.error(
          `[refresh] Error al consultar datos de usuario para email=${stored.emailInstitucional}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw new InternalServerErrorException('Error al consultar datos de usuario');
      }

      try {
        return await this.emitirTokens(datos);
      } catch (err) {
        this.logger.error(
          `[refresh] Error al emitir tokens para email=${stored.emailInstitucional}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw new InternalServerErrorException('Error al emitir nuevos tokens');
      }
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof InternalServerErrorException) {
        throw err;
      }

      this.logger.error(
        '[refresh] Error inesperado durante el proceso de refresh',
        err instanceof Error ? err.stack : String(err),
      );
      throw new InternalServerErrorException('Error interno al renovar token');
    }
  }

  // ── Logout por jti (fallback) ───────────────────────────────────────────
  async logout(jti: string): Promise<void> {
    await this.refreshRepo.update({ jti }, { revocado: true });
  }

  // ── Logout por token (desde cookie) ───────────────────────────────────────
  async logoutByToken(refreshTokenRaw: string): Promise<void> {
    try {
      const payload: { jti: string } = this.jwtService.decode(refreshTokenRaw) as { jti: string };
      if (payload?.jti) {
        await this.refreshRepo.update({ jti: payload.jti }, { revocado: true });
      }
    } catch {
      // Token malformado — ignorar, la cookie ya se borrará
    }
  }

  // ── Helpers privados ───────────────────────────────────────────────────────
  private async emitirTokens(datos: LoginFnResult): Promise<TokensResponse> {
    const issuer = this.config.get<string>('jwt.issuer');
    const audience = this.config.get<string>('jwt.audience');
    const jtiAccess = crypto.randomUUID();
    const jtiRefresh = crypto.randomUUID();

    // Access token: sub (uuid), email, datos institucionales, roles compactos, tipo, jti
    const accessToken = this.jwtService.sign(
      {
        sub: datos.usuario.id,
        email: datos.usuario.email,
        telefono: datos.usuario.telefono,
        nombre: datos.institucionalInfo.nombre,
        apellido: datos.institucionalInfo.apellido,
        puesto: datos.institucionalInfo.puesto,
        dependencia: datos.institucionalInfo.dependencia,
        fechaIngreso: datos.institucionalInfo.fechaIngreso,
        roles: datos.roles,
        tipo: 'access',
        jti: jtiAccess,
      },
      {
        algorithm: 'RS256',
        issuer,
        audience,
        expiresIn: this.config.get<string>('jwt.accessExpiration', '15m'),
      },
    );

    // Refresh token: solo identifica al usuario, sin datos sensibles
    const refreshTokenRaw = this.jwtService.sign(
      { sub: datos.usuario.email, tipo: 'refresh', jti: jtiRefresh },
      {
        algorithm: 'RS256',
        issuer,
        audience,
        expiresIn: this.config.get<string>('jwt.refreshExpiration', '7d'),
      },
    );

    // Guardar hash del refresh token en BD (expira en 10 minutos — pruebas)
    const expiracion = new Date();
    expiracion.setMinutes(expiracion.getMinutes() + 10);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        jti: jtiRefresh,
        emailInstitucional: datos.usuario.email,
        tokenHash: this.hashToken(refreshTokenRaw),
        expiracion,
        revocado: false,
      }),
    );

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async obtenerDatosParaRefresh(email: string): Promise<LoginFnResult> {
    const usuarioRows = await this.dataSource.query(
      `
      SELECT
        u.idusuario,
        u.emailinstitucional,
        u.activo,
        e.numtelefono,
        e.prinombre,
        e.priapellido,
        e.fecinglaborar,
        c.nomcargo,
        d.nomdependencia
      FROM core.usuarios u
      LEFT JOIN rrhh.empleados e ON e.emailinstitucional = u.emailinstitucional
      LEFT JOIN rrhh.cargos c ON c.idcargo = e.idcargo
      LEFT JOIN rrhh.dependencias d ON d.iddependencia = c.iddependencia
      WHERE u.emailinstitucional = $1
      LIMIT 1
      `,
      [email],
    );

    const usuario = (usuarioRows?.[0] ?? null) as UsuarioRefreshRow | null;
    if (!usuario || usuario.activo === false) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    const rolesRows = (await this.dataSource.query(
      `
      SELECT
        ur.idrol,
        COALESCE(
          array_agg(DISTINCT p.idmodulo) FILTER (WHERE p.idmodulo IS NOT NULL),
          '{}'
        ) AS modulos
      FROM core.usuario_roles ur
      LEFT JOIN core.roles_permisos rp ON rp.idrol = ur.idrol
      LEFT JOIN core.permisos p ON p.idpermiso = rp.idpermiso
      WHERE ur.idusuario = $1
      GROUP BY ur.idrol
      ORDER BY ur.idrol
      `,
      [usuario.idusuario],
    )) as RolRefreshRow[];

    return {
      status: 'OK',
      usuario: {
        id: usuario.idusuario,
        email: usuario.emailinstitucional,
        telefono: usuario.numtelefono ?? '',
      },
      institucionalInfo: {
        nombre: usuario.prinombre ?? '',
        apellido: usuario.priapellido ?? '',
        puesto: usuario.nomcargo ?? '',
        dependencia: usuario.nomdependencia ?? '',
        fechaIngreso: usuario.fecinglaborar
          ? new Date(usuario.fecinglaborar).toISOString().slice(0, 10)
          : '',
      },
      roles: rolesRows.map((row) => ({
        r: Number(row.idrol),
        m: (row.modulos ?? []).map((idModulo) => Number(idModulo)),
      })),
    };
  }
}
