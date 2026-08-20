import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/requiere-rol.decorator';
import { JwtPayload } from '../../core/auth/strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<number[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si el endpoint no exige roles concretos,
    // se permite continuar.
    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const usuario: JwtPayload = request.user;

    if (!usuario || !Array.isArray(usuario.roles)) {
      throw new ForbiddenException('No tiene acceso a este recurso');
    }

    /*
     * Intenta obtener el ID del rol desde:
     * idRol, idrol o r.
     *
     * Esto permite adaptarse a la estructura
     * actual del JWT: roles[].r
     */
    const rolesUsuario = usuario.roles
      .map((rol: any) => Number(rol.idRol ?? rol.idrol ?? rol.r))
      .filter((idRol: number) => Number.isFinite(idRol));

    const tieneAcceso = rolesPermitidos.some((idRolPermitido) =>
      rolesUsuario.includes(idRolPermitido),
    );

    if (!tieneAcceso) {
      throw new ForbiddenException(
        'Solo el Jefe Inmediato, Subgerente de RRHH y Administrador de RRHH pueden acceder',
      );
    }

    return true;
  }
}
