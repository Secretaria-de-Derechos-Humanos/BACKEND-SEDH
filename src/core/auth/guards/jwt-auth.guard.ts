import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
    if (err || !user) {
      this.logger.error(
        `JWT inválido o ausente: ${info?.message ?? err?.message ?? 'Usuario no autenticado'}`,
      );
    }

    return super.handleRequest(err, user, info, context, status);
  }
}
