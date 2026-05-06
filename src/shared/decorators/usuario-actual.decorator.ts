import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Usuario } from '../../core/usuarios/entities/usuario.entity';

export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Usuario => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
