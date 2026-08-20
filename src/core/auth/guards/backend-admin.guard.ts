import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class BackendAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const usuario = request.user;

    const esAdministrador = usuario?.roles?.some((rol: any) => Number(rol.r) === 5);

    if (esAdministrador) {
      return true;
    }

    throw new ForbiddenException('No tienes permisos de administrador');
  }
}
