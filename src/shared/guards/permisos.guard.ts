import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PERMISOS_KEY } from '../decorators/requiere-permiso.decorator';
import { JwtPayload } from '../../core/auth/strategies/jwt.strategy';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos = this.reflector.getAllAndOverride<string[]>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario: JwtPayload = request.user;

    if (!usuario?.email) {
      throw new ForbiddenException('No tiene permisos para acceder a este recurso');
    }

    // Consultar permisos actualizados desde la BD en cada request (usando uuid del usuario)
    const rows: { nompermiso: string }[] = await this.dataSource.query(
      `SELECT p.nompermiso
       FROM core.usuarios u
       JOIN core.usuario_roles ur  ON ur.idusuario = u.idusuario
       JOIN core.roles r           ON r.idrol = ur.idrol
       JOIN core.roles_permisos rp ON rp.idrol = r.idrol
       JOIN core.permisos p        ON p.idpermiso = rp.idpermiso
       WHERE u.idusuario = $1
         AND u.activo = true`,
      [usuario.sub],
    );

    const permisosUsuario = rows.map((r) => r.nompermiso);
    const tieneAcceso = requeridos.every((p) => permisosUsuario.includes(p));

    if (!tieneAcceso) {
      throw new ForbiddenException('No tiene permisos para acceder a este recurso');
    }

    return true;
  }
}
