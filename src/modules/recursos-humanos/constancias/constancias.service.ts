import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Constancia } from './entities/constancia.entity';
import { ConstanciaFinalidad } from './entities/constancia-finalidad.entity';
import { CrearConstanciaDto } from './dto/crear-constancia.dto';
import { EstadoSolicitud } from '../catalogos/entities/estado-solicitud.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class ConstanciasService {
  constructor(
    @InjectRepository(Constancia)
    private readonly constanciaRepo: Repository<Constancia>,

    @InjectRepository(ConstanciaFinalidad)
    private readonly finalidadRepo: Repository<ConstanciaFinalidad>,

    @InjectRepository(EstadoSolicitud)
    private readonly estadoSolicitudRepo: Repository<EstadoSolicitud>,

    private readonly notificacionesService: NotificacionesService,
  ) {}

  // ============================================================
  // CREAR SOLICITUD DE CONSTANCIA
  // ============================================================

  async crearConstancia(
    idUsuario: string,
    emailInstitucional: string,
    dto: CrearConstanciaDto,
  ): Promise<Constancia> {
    if (!dto.finalidades || dto.finalidades.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos una finalidad.');
    }

    const finalidadesPermitidas = ['PERSONAL', 'INJUPEM', 'SIAFI'];
    const finalidadesInvalidas = dto.finalidades.filter(
      (finalidad) => !finalidadesPermitidas.includes(finalidad),
    );

    if (finalidadesInvalidas.length > 0) {
      throw new BadRequestException('Una o más finalidades seleccionadas no son válidas.');
    }
    const estadoEnProceso = await this.obtenerEstadoSolicitud('EN PROCESO');
    const constancia = this.constanciaRepo.create({
      idUsuario,
      emailInstitucional,
      fecSolicitud: new Date(),
      modalidadSalario: dto.modalidadSalario,
      observaciones: dto.observaciones ?? null,
      idEstadoSolicitud: estadoEnProceso.idEstadoSolicitud,
      motRechazo: null,
      nombreArchivo: null,
      rutaArchivo: null,
      tipoArchivo: null,
      fechaGeneracion: null,
      generadoPor: null,
      fechaRecepcion: null,
      recibidoPor: null,
    });

    const constanciaGuardada = await this.constanciaRepo.save(constancia);
    const finalidades = dto.finalidades.map((finalidad) =>
      this.finalidadRepo.create({
        idConstancia: constanciaGuardada.idConstancia,
        finalidad,
      }),
    );

    await this.finalidadRepo.save(finalidades);
    await this.notificacionesService.crear(
      idUsuario,
      'Solicitud de constancia',
      'Su solicitud de constancia de trabajo fue registrada correctamente.',
      'CONSTANCIA',
      constanciaGuardada.idConstancia,
    );

    return constanciaGuardada;
  }

  // ============================================================
  // OBTENER MIS SOLICITUDES
  // ============================================================

  async obtenerMisConstancias(idUsuario: string): Promise<Constancia[]> {
    return this.constanciaRepo.find({
      where: {
        idUsuario,
      },
      relations: {
        estadoSolicitud: true,
      },
      order: {
        fecSolicitud: 'DESC',
      },
    });
  }

  // ============================================================
  // OBTENER UNA CONSTANCIA DEL USUARIO
  // ============================================================

  async obtenerMiConstancia(idConstancia: string, idUsuario: string): Promise<Constancia> {
    const constancia = await this.constanciaRepo.findOne({
      where: {
        idConstancia,
        idUsuario,
      },
      relations: {
        estadoSolicitud: true,
      },
    });

    if (!constancia) {
      throw new NotFoundException('La constancia no existe o no pertenece al usuario.');
    }

    return constancia;
  }

  // ============================================================
  // OBTENER TODAS PARA RRHH / ADMIN
  // ============================================================

  async obtenerTodas(): Promise<Constancia[]> {
    return this.constanciaRepo.find({
      relations: {
        estadoSolicitud: true,
      },
      order: {
        fecSolicitud: 'DESC',
      },
    });
  }

  // ============================================================
  // OBTENER SOLICITUDES EN PROCESO
  // ============================================================

  async obtenerPendientes(): Promise<Constancia[]> {
    const estadoEnProceso = await this.obtenerEstadoSolicitud('EN PROCESO');
    return this.constanciaRepo.find({
      where: {
        idEstadoSolicitud: estadoEnProceso.idEstadoSolicitud,
      },
      relations: {
        estadoSolicitud: true,
      },
      order: {
        fecSolicitud: 'ASC',
      },
    });
  }

  // ============================================================
  // RECHAZAR SOLICITUD
  // ============================================================

  async rechazarConstancia(
    idConstancia: string,
    idUsuarioRrhh: string,
    motivoRechazo: string,
  ): Promise<Constancia> {
    const constancia = await this.constanciaRepo.findOne({
      where: {
        idConstancia,
      },
    });

    if (!constancia) {
      throw new NotFoundException('La solicitud de constancia no existe.');
    }
    const estadoEnProceso = await this.obtenerEstadoSolicitud('EN PROCESO');
    if (constancia.idEstadoSolicitud !== estadoEnProceso.idEstadoSolicitud) {
      throw new BadRequestException('La solicitud de constancia ya fue procesada.');
    }

    if (!motivoRechazo || motivoRechazo.trim().length === 0) {
      throw new BadRequestException('Debe indicar el motivo del rechazo.');
    }

    const estadoRechazado = await this.obtenerEstadoSolicitud('RECHAZADO');
    constancia.idEstadoSolicitud = estadoRechazado.idEstadoSolicitud;
    constancia.motRechazo = motivoRechazo.trim();
    constancia.actualizadoPor = idUsuarioRrhh;
    const constanciaActualizada = await this.constanciaRepo.save(constancia);

    await this.notificacionesService.crear(
      constancia.idUsuario,
      'Solicitud de constancia rechazada',
      `Su solicitud de constancia fue rechazada. Motivo: ${motivoRechazo.trim()}`,
      'CONSTANCIA',
      constancia.idConstancia,
    );

    return constanciaActualizada;
  }

  // ============================================================
  // GENERAR CONSTANCIA - RRHH
  // ============================================================

  async generarConstancia(
    idConstancia: string,
    idUsuarioRrhh: string,
    archivo: Express.Multer.File,
  ): Promise<Constancia> {
    const constancia = await this.constanciaRepo.findOne({
      where: {
        idConstancia,
      },
    });

    if (!constancia) {
      throw new NotFoundException('La solicitud de constancia no existe.');
    }
    const estadoEnProceso = await this.obtenerEstadoSolicitud('EN PROCESO');
    if (constancia.idEstadoSolicitud !== estadoEnProceso.idEstadoSolicitud) {
      throw new BadRequestException('La solicitud de constancia ya fue procesada.');
    }

    if (!archivo) {
      throw new BadRequestException('Debe seleccionar un archivo.');
    }

    const estadoAprobado = await this.obtenerEstadoSolicitud('APROBADO');
    const fechaGeneracion = new Date();
    constancia.idEstadoSolicitud = estadoAprobado.idEstadoSolicitud;
    constancia.nombreArchivo = archivo.originalname;
    constancia.rutaArchivo = archivo.path;
    constancia.tipoArchivo = archivo.mimetype;
    constancia.fechaGeneracion = fechaGeneracion;
    constancia.generadoPor = idUsuarioRrhh;
    const constanciaActualizada = await this.constanciaRepo.save(constancia);
    await this.notificacionesService.crear(
      constancia.idUsuario,
      'Constancia disponible',
      'Su constancia de trabajo ya se encuentra disponible para descargar.',
      'CONSTANCIA',
      constancia.idConstancia,
    );

    return constanciaActualizada;
  }
  // ============================================================
  // OBTENER ARCHIVO DE CONSTANCIA
  // ============================================================

  async obtenerArchivoConstancia(
    idConstancia: string,
    idUsuario: string,
  ): Promise<{
    rutaArchivo: string;
    nombreArchivo: string;
    tipoArchivo: string;
  }> {
    const constancia = await this.constanciaRepo.findOne({
      where: {
        idConstancia,
        idUsuario,
      },
    });

    if (!constancia) {
      throw new NotFoundException('La constancia no existe o no pertenece al usuario.');
    }
    const estadoAprobado = await this.obtenerEstadoSolicitud('APROBADO');

    if (constancia.idEstadoSolicitud !== estadoAprobado.idEstadoSolicitud) {
      throw new BadRequestException('La constancia todavía no está disponible para descargar.');
    }

    if (!constancia.rutaArchivo) {
      throw new NotFoundException('La constancia todavía no tiene un documento disponible.');
    }

    if (!constancia.nombreArchivo) {
      throw new NotFoundException('La constancia no tiene un nombre de archivo válido.');
    }

    if (!constancia.tipoArchivo) {
      throw new NotFoundException('La constancia no tiene un tipo de archivo válido.');
    }

    return {
      rutaArchivo: constancia.rutaArchivo,
      nombreArchivo: constancia.nombreArchivo,
      tipoArchivo: constancia.tipoArchivo,
    };
  }
  // ============================================================
  // OBTENER ESTADO DE SOLICITUD
  // ============================================================

  private async obtenerEstadoSolicitud(nombreEstado: string): Promise<EstadoSolicitud> {
    const estado = await this.estadoSolicitudRepo
      .createQueryBuilder('estado')
      .where('LOWER(estado.nomestado) = LOWER(:nombreEstado)', {
        nombreEstado,
      })
      .getOne();

    if (!estado) {
      throw new NotFoundException(`No se encontró el estado de solicitud: ${nombreEstado}.`);
    }

    return estado;
  }
}
