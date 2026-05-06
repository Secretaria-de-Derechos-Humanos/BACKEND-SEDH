import { SetMetadata } from '@nestjs/common';

export const PERMISOS_KEY = 'permisos';

export const RequierePermiso = (...nomPermisos: string[]) =>
  SetMetadata(PERMISOS_KEY, nomPermisos);
