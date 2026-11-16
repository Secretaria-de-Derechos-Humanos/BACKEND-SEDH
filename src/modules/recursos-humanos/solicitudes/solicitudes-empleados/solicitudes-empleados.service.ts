import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { DataSource } from 'typeorm';
import { createReadStream, existsSync } from 'fs';
import { resolve, sep, extname } from 'path';
import { StreamableFile } from '@nestjs/common';

@Injectable()
export class SolicitudesEmpleadosService {
  private readonly logger = new Logger(SolicitudesEmpleadosService.name);
  constructor(private readonly dataSource: DataSource) {}

  async getSolicitudesEmpleadoRRHH(email: string) {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT rrhh.mis_solicitudes($1) AS resultado
        `,
        [email],
      );

      return rows[0]?.resultado;
    } catch (error) {
      this.manejarError(
        'getSolicitudesEmpleadoRRHH',
        error,
        'No se pudieron obtener las solicitudes',
      );
    }
  }

  async getMisSolicitudesEmergencia(email: string) {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT rrhh.mis_solicitudes_emergencia($1) AS resultado
        `,
        [email],
      );

      return rows[0]?.resultado;
    } catch (error) {
      this.manejarError(
        'getMisSolicitudesEmergencia',
        error,
        'No se pudieron obtener las solicitudes de emergencia',
      );
    }
  }
  async descargarComprobanteEmergencia(idPermiso: string) {
    try {
      const rows = await this.dataSource.query(
        `
      SELECT
        referenciadocumento,
        catemergencia,
        estado_comprobante
      FROM rrhh.permisos_personales
      WHERE idpermisopersonal = $1::uuid
      LIMIT 1
      `,
        [idPermiso],
      );

      const permiso = rows[0];

      if (!permiso) {
        throw new NotFoundException('No se encontró el permiso solicitado');
      }

      if (permiso.catemergencia !== true) {
        throw new BadRequestException('El permiso no corresponde a una emergencia médica');
      }

      if (permiso.estado_comprobante !== 'ENTREGADO' || !permiso.referenciadocumento) {
        throw new NotFoundException('El comprobante médico no está disponible');
      }

      const directorioPermitido = resolve(process.cwd(), 'uploads', 'permisos-personales');

      const rutaArchivo = resolve(process.cwd(), permiso.referenciadocumento);

      if (!rutaArchivo.startsWith(directorioPermitido + sep) || !existsSync(rutaArchivo)) {
        throw new NotFoundException('No se encontró el archivo del comprobante');
      }

      const extension = extname(rutaArchivo).toLowerCase();

      const tiposPermitidos: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
      };

      const contentType = tiposPermitidos[extension];

      if (!contentType) {
        throw new BadRequestException('Formato de comprobante no permitido');
      }

      return new StreamableFile(createReadStream(rutaArchivo), {
        type: contentType,
        disposition: `attachment; filename="comprobante-medico${extension}"`,
      });
    } catch (error) {
      this.manejarError(
        'descargarComprobanteEmergencia',
        error,
        'No se pudo descargar el comprobante médico',
      );
    }
  }

  async cargarDatosAgregarPermisos(email: string) {
    try {
      const rows = await this.dataSource.query(
        `
        SELECT rrhh.cargar_datos_para_agregar_permisos($1) AS resultado
        `,
        [email],
      );

      return rows[0]?.resultado;
    } catch (error) {
      this.manejarError(
        'cargarDatosAgregarPermisos',
        error,
        'No se pudieron cargar los datos del permiso',
      );
    }
  }

  private manejarError(metodo: string, error: unknown, mensaje: string): never {
    this.logger.error(metodo, error instanceof Error ? error.stack : String(error));

    if (error instanceof HttpException) {
      throw error;
    }

    throw new InternalServerErrorException(mensaje);
  }
}
