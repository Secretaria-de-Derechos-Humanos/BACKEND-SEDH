import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CargarSolicitudesAgenteDto } from './dto/cargar-solicitudes-agente.dto';
import { RegistrarHoraSalidaDto } from './dto/registrar-hora-salida.dto';
import { RegistrarHoraRetornoDto } from './dto/registrar-hora-retorno.dto';

@Injectable()
export class SolicitudesAgenteSeguriadService {
  private readonly logger = new Logger(SolicitudesAgenteSeguriadService.name);

  constructor(private readonly dataSource: DataSource) {}

  async cargarSolicitudes(dto: CargarSolicitudesAgenteDto) {
    try {
      const rows = await this.dataSource.query(
        'SELECT * FROM rrhh.cargar_solicitudes_agente_seguridad($1, $2, $3)',
        [dto.email, String(dto.rol), String(dto.idmodulo)],
      );
      return rows[0]?.cargar_solicitudes_agente_seguridad ?? { solicitudesAgente: [] };
    } catch (error) {
      this.logger.error(`Error en cargarSolicitudes: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }

  async registrarHoraSalida(dto: RegistrarHoraSalidaDto) {
    try {
      const rows = await this.dataSource.query(
        'SELECT rrhh.responder_hora_salida_agente($1, $2, $3, $4, $5, $6)',
        [
          dto.idpermiso,
          dto.tipo,
          dto.email,
          dto.horaSalida,
          String(dto.rol),
          String(dto.idmodulo),
        ],
      );
      return rows[0]?.responder_hora_salida_agente ?? null;
    } catch (error) {
      this.logger.error(`Error en registrarHoraSalida: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }

  async registrarHoraRetorno(dto: RegistrarHoraRetornoDto) {
    try {
      const rows = await this.dataSource.query(
        'SELECT rrhh.responder_hora_retorno_agente($1, $2, $3, $4, $5, $6)',
        [
          dto.idpermiso,
          dto.tipo,
          dto.email,
          dto.horaRetorno,
          String(dto.rol),
          String(dto.idmodulo),
        ],
      );
      return rows[0]?.responder_hora_retorno_agente ?? null;
    } catch (error) {
      this.logger.error(`Error en registrarHoraRetorno: ${error}`);
      throw new InternalServerErrorException(`DB Error: ${(error as Error).message}`);
    }
  }
}
