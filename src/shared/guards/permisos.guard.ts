import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISOS_KEY } from '../decorators/requiere-permiso.decorator';
import { Usuario } from '../../core/usuarios/entities/usuario.entity';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[]>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario: Usuario = request.user;

    if (!usuario?.roles) {
      throw new ForbiddenException('No tiene permisos para acceder a este recurso');
    }

    // Obtener todos los nombres de permisos del usuario a través de sus roles
    const permisosUsuario = usuario.roles.flatMap((rol) =>
      rol.permisos.map((p) => p.nomPermiso),
    );

    const tieneAcceso = requeridos.every((p) => permisosUsuario.includes(p));

    if (!tieneAcceso) {
      throw new ForbiddenException('No tiene permisos para acceder a este recurso');
    }

    return true;
  }
}
