import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class AgenteSeguridadGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const rolesPermitidos = [4, 5];

    const tieneRolPermitido =
      Array.isArray(user.roles) &&
      user.roles.some((rol) => rolesPermitidos.includes(Number(rol.r)));

    if (!tieneRolPermitido) {
      throw new ForbiddenException(
        'No tiene permisos para acceder al módulo de agente de seguridad',
      );
    }

    return true;
  }
}
