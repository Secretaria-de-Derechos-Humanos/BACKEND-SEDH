import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULOS_KEY } from '../decorators/requiere-permiso.decorator';
import { JwtPayload } from '../../core/auth/strategies/jwt.strategy';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<number[]>(MODULOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario: JwtPayload = request.user;

    if (!usuario?.roles) {
      throw new ForbiddenException('No tiene acceso a este recurso');
    }

    // Los módulos del usuario vienen en el JWT: roles[].m[]
    const modulosUsuario = usuario.roles.flatMap((r) => r.m);
    const tieneAcceso = requeridos.some((idMod) => modulosUsuario.includes(idMod));

    if (!tieneAcceso) {
      throw new ForbiddenException('No tiene acceso a este recurso');
    }

    return true;
  }
}
