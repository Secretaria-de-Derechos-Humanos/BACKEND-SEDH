import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const employee = request.user;

    if (!employee?.role?.permissions) {
      throw new ForbiddenException('No tiene permisos para acceder a este recurso');
    }

    const employeePermissions: RequiredPermission[] = employee.role.permissions;

    const hasAll = required.every((req) =>
      employeePermissions.some(
        (p) =>
          p.module === req.module &&
          (p.subModule === undefined || p.subModule === req.subModule) &&
          (p.action === req.action || p.action === 'manage'),
      ),
    );

    if (!hasAll) {
      throw new ForbiddenException('No tiene permisos para acceder a este recurso');
    }

    return true;
  }
}
