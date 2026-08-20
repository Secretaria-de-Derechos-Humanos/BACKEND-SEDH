import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'rolesPermitidos';

/**
 * Permite acceder únicamente a usuarios que posean
 * alguno de los roles indicados.
 */
export const RequiereRol = (...idRoles: number[]) => SetMetadata(ROLES_KEY, idRoles);
