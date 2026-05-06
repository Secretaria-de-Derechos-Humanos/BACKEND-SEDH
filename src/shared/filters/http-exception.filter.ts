import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const errorMessage =
      exception instanceof HttpException
        ? typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any)?.message ?? 'Error desconocido'
        : 'Error interno del servidor';

    const details =
      exception instanceof HttpException &&
      typeof exceptionResponse === 'object' &&
      Array.isArray((exceptionResponse as any)?.message)
        ? (exceptionResponse as any).message
        : [];

    // Nunca exponer stack trace en producción
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code: this.resolveErrorCode(status),
        message: Array.isArray(errorMessage) ? errorMessage[0] : errorMessage,
        details,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolveErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'PERMISSION_DENIED',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return codes[status] ?? 'UNKNOWN_ERROR';
  }
}
