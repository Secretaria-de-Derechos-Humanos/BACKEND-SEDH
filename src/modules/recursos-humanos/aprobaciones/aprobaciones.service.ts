import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PermisoPersonal } from '../solicitudes/permisos-personales/entities/permiso-personal.entity';
import { PermisoOficial } from '../solicitudes/permisos-oficiales/entities/permiso-oficial.entity';
import { EstadoSolicitud } from '../catalogos/entities/estado-solicitud.entity';
import { Vacaciones } from '../solicitudes/vacaciones/entities/vacaciones.entity';

@Injectable()
export class AprobacionesService {
  constructor(
    @InjectRepository(PermisoPersonal)
    private readonly permisoPersonalRepo: Repository<PermisoPersonal>,

    @InjectRepository(PermisoOficial)
    private readonly permisosOficialesRepo: Repository<PermisoOficial>,

    @InjectRepository(Vacaciones)
    private readonly vacacionesRepo: Repository<Vacaciones>,

    @InjectRepository(EstadoSolicitud)
    private readonly estadoSolicitudRepo: Repository<EstadoSolicitud>,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lista todos los permisos oficiales.
   */
  async listarPermisosOficiales() {
    return this.permisosOficialesRepo.find({
      relations: {
        tipoSolicitud: true,
        estadoSolicitud: true,
      },
      order: {
        fecSolicitud: 'DESC',
      },
    });
  }

  /**
   * Lista todas las solicitudes que están EN PROCESO.
   */
  async listarPendientes() {
    const estadoEnProceso = await this.obtenerEstadoPorNombre('EN PROCESO');

    const [permisosPersonales, permisosOficiales, solicitudesVacaciones] = await Promise.all([
      // Permisos personales
      this.permisoPersonalRepo.find({
        where: {
          idEstadoSolicitud: estadoEnProceso.idEstadoSolicitud,
        },
        relations: {
          tipoSolicitud: true,
          estadoSolicitud: true,
        },
        order: {
          fecSolicitud: 'DESC',
        },
      }),

      // Permisos oficiales
      this.permisosOficialesRepo.find({
        where: {
          idEstadoSolicitud: estadoEnProceso.idEstadoSolicitud,
        },
        relations: {
          tipoSolicitud: true,
          estadoSolicitud: true,
        },
        order: {
          fecSolicitud: 'DESC',
        },
      }),

      // Solicitudes de vacaciones
      this.vacacionesRepo.find({
        where: {
          idEstadoSolicitud: estadoEnProceso.idEstadoSolicitud,
        },
        relations: {
          tipoSolicitud: true,
          estadoSolicitud: true,
          cargo: true,
          tipoContratacion: true,
        },
        order: {
          fecSolicitud: 'DESC',
        },
      }),
    ]);

    const personales = permisosPersonales.map((permiso) => ({
      id: permiso.idPermisoPersonal,
      idPermisoPersonal: permiso.idPermisoPersonal,
      idPermisoOficial: null,
      idPermisoVaca: null,
      categoria: 'PERMISO_PERSONAL',
      origen: 'PERSONAL',
      emailInstitucional: permiso.emailInstitucional,

      tipoSolicitud: {
        nomTipo: permiso.tipoSolicitud?.nomTipo ?? 'PERMISO PERSONAL',
      },

      fecSolicitud: permiso.fecSolicitud,
      horSalida: permiso.horSalida,
      horRetorno: permiso.horRetorno,
      horSolicitadas: permiso.horSolicitadas,
      idHorasDisponibles: permiso.idHorasDisponibles,
      motivo: permiso.motivo,
      catEmergencia: permiso.catEmergencia ?? false,
      guardiaTurno: null,
      fecInicial: null,
      fecFinal: null,
      fecRetorno: null,
      cantVacaciones: null,
      totDiasRestantes: null,

      estado: permiso.estadoSolicitud?.nomEstado ?? 'EN PROCESO',
    }));

    const oficiales = permisosOficiales.map((permiso) => ({
      id: permiso.idPermisoOficial,

      // Se conserva para que la tabla
      // actual pueda usar un identificador común.
      idPermisoPersonal: permiso.idPermisoOficial,
      idPermisoOficial: permiso.idPermisoOficial,
      idPermisoVaca: null,

      categoria: 'PERMISO_OFICIAL',
      origen: 'OFICIAL',
      emailInstitucional: permiso.emailInstitucional,

      tipoSolicitud: {
        nomTipo: permiso.tipoSolicitud?.nomTipo ?? 'PERMISO OFICIAL',
      },

      fecSolicitud: permiso.fecSolicitud,
      horSalida: permiso.horSalida,
      horRetorno: permiso.horRetorno,
      horSolicitadas: permiso.tiempoLimite,
      idHorasDisponibles: null,
      motivo: permiso.motivo,
      catEmergencia: false,
      guardiaTurno: permiso.guardiaTurno,
      fecInicial: null,
      fecFinal: null,
      fecRetorno: null,
      cantVacaciones: null,
      totDiasRestantes: null,

      estado: permiso.estadoSolicitud?.nomEstado ?? 'EN PROCESO',
    }));

    const vacaciones = solicitudesVacaciones.map((vacacion) => ({
      id: vacacion.idPermisoVaca,

      // Identificador común para la tabla actual.
      idPermisoPersonal: vacacion.idPermisoVaca,
      idPermisoOficial: null,
      idPermisoVaca: vacacion.idPermisoVaca,

      categoria: 'VACACIONES',
      origen: 'VACACIONES',
      emailInstitucional: vacacion.emailInstitucional,

      tipoSolicitud: {
        nomTipo: vacacion.tipoSolicitud?.nomTipo ?? 'VACACIONES',
      },

      fecSolicitud: vacacion.fecSolicitud,

      // Las vacaciones no manejan horas.
      horSalida: null,
      horRetorno: null,

      // Se utiliza esta propiedad común
      // para mostrar la cantidad de días.
      horSolicitadas: vacacion.cantVacaciones,
      idHorasDisponibles: vacacion.totDiasRestantes,
      motivo: vacacion.observaciones,
      catEmergencia: false,
      guardiaTurno: null,
      fecInicial: vacacion.fecInicial,
      fecFinal: vacacion.fecFinal,
      fecRetorno: vacacion.fecRetorno,
      cantVacaciones: vacacion.cantVacaciones,
      perAnterior: vacacion.perAnterior,
      cantPerAnterior: vacacion.cantPerAnterior,
      perActual: vacacion.perActual,
      cantPerActual: vacacion.cantPerActual,
      totDiasPeriodos: vacacion.totDiasPeriodos,
      totDiasRestantes: vacacion.totDiasRestantes,
      observaciones: vacacion.observaciones,
      cargo: vacacion.cargo,
      tipoContratacion: vacacion.tipoContratacion,

      estado: vacacion.estadoSolicitud?.nomEstado ?? 'EN PROCESO',
    }));

    return [...personales, ...oficiales, ...vacaciones].sort(
      (a, b) => new Date(b.fecSolicitud).getTime() - new Date(a.fecSolicitud).getTime(),
    );
  }

  /**
   * Lista permisos personales aprobados
   * y rechazados.
   */
  async listarHistorial() {
    const estadoAprobado = await this.obtenerEstadoPorNombre('APROBADO');

    const estadoRechazado = await this.obtenerEstadoPorNombre('RECHAZADO');

    const permisos = await this.permisoPersonalRepo.find({
      where: {
        idEstadoSolicitud: In([
          estadoAprobado.idEstadoSolicitud,
          estadoRechazado.idEstadoSolicitud,
        ]),
      },
      relations: {
        tipoSolicitud: true,
        estadoSolicitud: true,
      },
      order: {
        fecSolicitud: 'DESC',
      },
    });

    return permisos.map((permiso) => ({
      id: permiso.idPermisoPersonal,
      categoria: 'PERMISO_PERSONAL',
      emailInstitucional: permiso.emailInstitucional,

      tipoSolicitud: permiso.tipoSolicitud?.nomTipo ?? 'PERMISO PERSONAL',

      fechaSolicitud: permiso.fecSolicitud,
      horaSalida: permiso.horSalida,
      horaRetorno: permiso.horRetorno,
      horasSolicitadas: permiso.horSolicitadas,
      horasDisponibles: permiso.idHorasDisponibles,
      motivo: permiso.motivo,
      emergencia: permiso.catEmergencia ?? false,

      estado: permiso.estadoSolicitud?.nomEstado ?? 'SIN ESTADO',

      procesadoPor: permiso.priAprobacion,
      segundaAprobacion: permiso.segAprobacion,
      motivoRechazo: permiso.motRechazo,
    }));
  }

  /**
   * Aprobar permiso personal.
   */
  async aprobarPermisoPersonal(idPermisoPersonal: string, emailAprobador: string) {
    const permiso = await this.permisoPersonalRepo.findOne({
      where: {
        idPermisoPersonal,
      },
      relations: {
        estadoSolicitud: true,
      },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso personal ${idPermisoPersonal} no encontrado`);
    }

    const estadoEnProceso = await this.obtenerEstadoPorNombre('EN PROCESO');

    if (permiso.idEstadoSolicitud !== estadoEnProceso.idEstadoSolicitud) {
      throw new BadRequestException('La solicitud ya fue aprobada o rechazada');
    }

    const estadoAprobado = await this.obtenerEstadoPorNombre('APROBADO');

    permiso.idEstadoSolicitud = estadoAprobado.idEstadoSolicitud;

    permiso.priAprobacion = emailAprobador;
    permiso.motRechazo = null;

    const actualizado = await this.permisoPersonalRepo.save(permiso);

    /*
     * No se devuelve success/data manualmente
     * porque el proyecto tiene un interceptor global.
     */
    return actualizado;
  }

  /**
   * Rechazar permiso personal.
   */
  async rechazarPermisoPersonal(
    idPermisoPersonal: string,
    emailAprobador: string,
    motivoRechazo: string,
  ) {
    const motivo = motivoRechazo?.trim();

    if (!motivo) {
      throw new BadRequestException('Debe ingresar el motivo del rechazo');
    }

    const permiso = await this.permisoPersonalRepo.findOne({
      where: {
        idPermisoPersonal,
      },
      relations: {
        estadoSolicitud: true,
      },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso personal ${idPermisoPersonal} no encontrado`);
    }

    const estadoEnProceso = await this.obtenerEstadoPorNombre('EN PROCESO');

    if (permiso.idEstadoSolicitud !== estadoEnProceso.idEstadoSolicitud) {
      throw new BadRequestException('La solicitud ya fue aprobada o rechazada');
    }

    const estadoRechazado = await this.obtenerEstadoPorNombre('RECHAZADO');

    const motivoFinal = motivo.substring(0, 100);

    await this.dataSource.query(
      `
      UPDATE rrhh.permisos_personales
      SET
        idestadosolicitud = $2::uuid,
        priaprobacion = $3,
        motrechazo = $4,
        actualizadoen = CURRENT_DATE,
        actualizadopor = $3
      WHERE idpermisopersonal = $1::uuid
    `,
      [idPermisoPersonal, estadoRechazado.idEstadoSolicitud, emailAprobador, motivoFinal],
    );

    return this.permisoPersonalRepo.findOne({
      where: {
        idPermisoPersonal,
      },
      relations: {
        estadoSolicitud: true,
      },
    });
  }
  /**
   * Aprobar permiso oficial.
   */
  async aprobarPermisoOficial(idPermisoOficial: string, emailAprobador: string) {
    const permiso = await this.permisosOficialesRepo.findOne({
      where: {
        idPermisoOficial,
      },
      relations: {
        estadoSolicitud: true,
      },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso oficial ${idPermisoOficial} no encontrado`);
    }

    const estadoEnProceso = await this.obtenerEstadoPorNombre('EN PROCESO');

    if (permiso.idEstadoSolicitud !== estadoEnProceso.idEstadoSolicitud) {
      throw new BadRequestException('La solicitud ya fue aprobada o rechazada');
    }

    const estadoAprobado = await this.obtenerEstadoPorNombre('APROBADO');

    permiso.idEstadoSolicitud = estadoAprobado.idEstadoSolicitud;

    permiso.priAprobacion = emailAprobador;
    permiso.motRechazo = null;

    return this.permisosOficialesRepo.save(permiso);
  }

  /**
   * Rechazar permiso oficial.
   *
   * Flujo permitido:
   * EN PROCESO -> RECHAZADO
   *
   * El rechazo NO requiere que el permiso
   * haya sido aprobado previamente.
   */
  async rechazarPermisoOficial(
    idPermisoOficial: string,
    emailAprobador: string,
    motivoRechazo: string,
  ) {
    const motivo = motivoRechazo?.trim();

    if (!motivo) {
      throw new BadRequestException('Debe ingresar el motivo del rechazo');
    }

    const permiso = await this.permisosOficialesRepo.findOne({
      where: {
        idPermisoOficial,
      },
      relations: {
        estadoSolicitud: true,
      },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso oficial ${idPermisoOficial} no encontrado`);
    }

    /*
     * El permiso solamente puede rechazarse
     * cuando todavía está EN PROCESO.
     */
    const estadoEnProceso = await this.obtenerEstadoPorNombre('EN PROCESO');

    if (permiso.idEstadoSolicitud !== estadoEnProceso.idEstadoSolicitud) {
      throw new BadRequestException('La solicitud ya fue aprobada o rechazada');
    }

    const estadoRechazado = await this.obtenerEstadoPorNombre('RECHAZADO');

    const motivoFinal = motivo.substring(0, 100);

    /*
     * Se utiliza UPDATE directo porque el guardado
     * mediante TypeORM estaba conservando el motivo
     * y el aprobador, pero no estaba persistiendo
     * correctamente el idestadosolicitud.
     */
    await this.dataSource.query(
      `
        UPDATE rrhh.permisos_oficiales
        SET
          idestadosolicitud = $2::uuid,
          priaprobacion = $3,
          motrechazo = $4,
          actualizadoen = CURRENT_DATE,
          actualizadopor = $3
        WHERE idpermisooficial = $1::uuid
      `,
      [idPermisoOficial, estadoRechazado.idEstadoSolicitud, emailAprobador, motivoFinal],
    );

    /*
     * Se vuelve a consultar el registro para devolver
     * el estado actualizado y la relación estadoSolicitud.
     */
    return this.permisosOficialesRepo.findOne({
      where: {
        idPermisoOficial,
      },
      relations: {
        estadoSolicitud: true,
      },
    });
  }

  /**
   * Busca un estado ignorando
   * mayúsculas, minúsculas y espacios.
   */
  private async obtenerEstadoPorNombre(nombre: string): Promise<EstadoSolicitud> {
    const estado = await this.estadoSolicitudRepo
      .createQueryBuilder('estado')
      .where('UPPER(TRIM(estado.nomEstado)) = :nombre', {
        nombre: nombre.trim().toUpperCase(),
      })
      .getOne();

    if (!estado) {
      throw new NotFoundException(`No existe el estado de solicitud ${nombre}`);
    }

    return estado;
  }
}
