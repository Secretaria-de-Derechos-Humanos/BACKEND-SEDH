import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  module: string;
  subModule?: string;
  action: 'read' | 'create' | 'update' | 'delete' | 'manage';
}

export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
