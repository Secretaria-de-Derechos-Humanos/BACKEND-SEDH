import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  timestamp: string;
  accessToken?: string;
}

function getHondurasTimestamp(): string {
  const now = new Date();
  const hondurasDate = new Date(now.getTime() + -6 * 60 * 60 * 1000);
  return hondurasDate.toISOString().replace('Z', '-06:00');
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const respuesta: ApiResponse<T> = {
          success: true,
          data: data ?? null,
          message: (data as any)?.message ?? 'Operación exitosa',
          timestamp: getHondurasTimestamp(),
        };

        // Compatibilidad hacia atras: algunos clientes leen accessToken en la raiz.
        const posibleAccessToken = (data as any)?.accessToken;
        if (typeof posibleAccessToken === 'string' && posibleAccessToken.length > 0) {
          respuesta.accessToken = posibleAccessToken;
        }

        return respuesta;
      }),
    );
  }
}
