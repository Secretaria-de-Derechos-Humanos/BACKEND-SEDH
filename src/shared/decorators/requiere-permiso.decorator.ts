import { SetMetadata } from '@nestjs/common';

export const MODULOS_KEY = 'modulos';

/**
 * Protege un endpoint verificando que el usuario tenga acceso
 * a al menos uno de los módulos indicados (por idmodulo).
 * Los IDs vienen del JWT payload: roles[].m[]
 */
export const RequiereModulo = (...idModulos: number[]) => SetMetadata(MODULOS_KEY, idModulos);
