import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionRepo: Repository<Notificacion>,
  ) {}

  // ============================================================
  // LISTAR TODAS
  // ============================================================

  async listarPorUsuario(idUsuario: string): Promise<Notificacion[]> {
    return this.notificacionRepo.find({
      where: {
        idUsuario,
      },

      order: {
        fechaCreacion: 'DESC',
      },
    });
  }

  // ============================================================
  // LISTAR NO LEÍDAS
  // ============================================================

  async listarNoLeidas(idUsuario: string): Promise<Notificacion[]> {
    return this.notificacionRepo.find({
      where: {
        idUsuario,
        leida: false,
      },

      order: {
        fechaCreacion: 'DESC',
      },
    });
  }

  // ============================================================
  // CONTADOR
  // ============================================================

  async contarNoLeidas(idUsuario: string): Promise<number> {
    return this.notificacionRepo.count({
      where: {
        idUsuario,
        leida: false,
      },
    });
  }

  // ============================================================
  // CREAR NOTIFICACIÓN
  // ============================================================

  async crear(
    idUsuario: string,
    titulo: string,
    mensaje: string,
    tipo: string,
    idSolicitud: string | null = null,
  ): Promise<Notificacion> {
    const notificacion = this.notificacionRepo.create({
      idUsuario,
      titulo,
      mensaje,
      tipo,
      idSolicitud,
      leida: false,
    });

    return this.notificacionRepo.save(notificacion);
  }

  // ============================================================
  // MARCAR UNA COMO LEÍDA
  // ============================================================

  async marcarComoLeida(idNotificacion: string, idUsuario: string): Promise<Notificacion> {
    const notificacion = await this.notificacionRepo.findOne({
      where: {
        idNotificacion,
        idUsuario,
      },
    });

    if (!notificacion) {
      throw new NotFoundException('Notificación no encontrada.');
    }

    notificacion.leida = true;

    return this.notificacionRepo.save(notificacion);
  }

  // ============================================================
  // MARCAR TODAS COMO LEÍDAS
  // ============================================================

  async marcarTodasComoLeidas(idUsuario: string): Promise<void> {
    await this.notificacionRepo.update(
      {
        idUsuario,
        leida: false,
      },
      {
        leida: true,
      },
    );
  }
}
