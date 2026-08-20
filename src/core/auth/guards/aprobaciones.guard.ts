import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AprobacionesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles) {
      throw new ForbiddenException('No tienes permisos para acceder a este recurso');
    }

    const rolesPermitidos = [2, 3, 5];
    const tieneAcceso = user.roles.some((rol: any) => rolesPermitidos.includes(rol.r));
    if (tieneAcceso) {
      return true;
    }

    throw new ForbiddenException('No tienes permisos para acceder a Gestión de Aprobaciones.');
  }
}
