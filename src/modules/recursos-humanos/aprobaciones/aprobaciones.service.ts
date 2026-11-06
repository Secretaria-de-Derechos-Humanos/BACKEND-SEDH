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
   * Lista solicitudes pendientes de aprobación.
   *
   * Permisos personales:
   * Solamente muestra los que ya fueron aprobados
   * por el Jefe Inmediato y están pendientes de RR. HH.
   *
   * Permisos oficiales y vacaciones:
   * Conservan su consulta actual.
   */

  async listarPendientes(rol: number) {
    const estadoEnProceso = await this.obtenerEstadoPorNombre('EN PROCESO');

    const esAdministrador = Number(rol) === 5;

    const [permisosPersonales, permisosOficiales, solicitudesVacaciones] = await Promise.all([
      // PERMISOS PERSONALES
      (() => {
        const query = this.permisoPersonalRepo
          .createQueryBuilder('permiso')
          .leftJoinAndSelect('permiso.tipoSolicitud', 'tipoSolicitud')
          .leftJoinAndSelect('permiso.estadoSolicitud', 'estadoSolicitud')
          .where('permiso.idEstadoSolicitud = :estado', {
            estado: estadoEnProceso.idEstadoSolicitud,
          });

        if (!esAdministrador) {
          query
            .andWhere("NULLIF(TRIM(permiso.priAprobacion), '') IS NOT NULL")
            .andWhere("NULLIF(TRIM(permiso.segAprobacion), '') IS NULL");
        }

        return query.orderBy('permiso.fecSolicitud', 'DESC').getMany();
      })(),

      // PERMISOS OFICIALES: SIN CAMBIOS
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

      // VACACIONES: SIN CAMBIOS
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

    // CONSULTAR SALDOS REALES DE HORAS DISPONIBLES
    const correosPersonales = [
      ...new Set(
        permisosPersonales.map((permiso) => permiso.emailInstitucional.trim().toLowerCase()),
      ),
    ];

    const saldosDisponibles = correosPersonales.length
      ? await this.dataSource.query(
          `
        SELECT
          LOWER(TRIM(emailinstitucional)) AS correo,
          hordisponibles AS "horasDisponibles"
        FROM rrhh.horas_disponibles
        WHERE LOWER(TRIM(emailinstitucional)) = ANY($1::text[])
        `,
          [correosPersonales],
        )
      : [];

    const mapaSaldos = new Map<string, string>(
      saldosDisponibles.map((item: any) => [item.correo, item.horasDisponibles]),
    );

    // MAPEAR PERMISOS PERSONALES
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

      // Se conserva el identificador original
      idHorasDisponibles: permiso.idHorasDisponibles,

      // Se devuelve el saldo real de horas
      horasDisponibles:
        mapaSaldos.get(permiso.emailInstitucional.trim().toLowerCase()) ?? '00:00:00',

      motivo: permiso.motivo,
      catEmergencia: permiso.catEmergencia ?? false,
      guardiaTurno: null,
      fecInicial: null,
      fecFinal: null,
      fecRetorno: null,
      cantVacaciones: null,

      estado: permiso.estadoSolicitud?.nomEstado ?? 'EN PROCESO',
    }));

    // MAPEAR PERMISOS OFICIALES
    const oficiales = permisosOficiales.map((permiso) => ({
      id: permiso.idPermisoOficial,
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

    // MAPEAR VACACIONES
    const vacaciones = solicitudesVacaciones.map((vacacion) => ({
      id: vacacion.idPermisoVaca,
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
      horSalida: null,
      horRetorno: null,
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

    // Obtener correos institucionales de los empleados del historial
    const correos = [
      ...new Set(
        permisos
          .map((permiso) => permiso.emailInstitucional?.trim().toLowerCase())
          .filter((correo): correo is string => Boolean(correo)),
      ),
    ];

    // Consultar el saldo ACTUAL de horas disponibles
    const saldosDisponibles = correos.length
      ? await this.dataSource.query(
          `
        SELECT
          LOWER(TRIM(emailinstitucional)) AS correo,
          hordisponibles AS "horasDisponibles"
        FROM rrhh.horas_disponibles
        WHERE LOWER(TRIM(emailinstitucional)) = ANY($1::text[])
        `,
          [correos],
        )
      : [];

    // Relacionar el saldo actual con cada empleado
    const mapaSaldos = new Map<string, string>(
      saldosDisponibles.map((item: any) => [item.correo, item.horasDisponibles]),
    );

    return permisos.map((permiso) => ({
      id: permiso.idPermisoPersonal,
      categoria: 'PERMISO_PERSONAL',
      emailInstitucional: permiso.emailInstitucional,

      tipoSolicitud: permiso.tipoSolicitud?.nomTipo ?? 'PERMISO PERSONAL',

      fechaSolicitud: permiso.fecSolicitud,
      horaSalida: permiso.horSalida,
      horaRetorno: permiso.horRetorno,
      horasSolicitadas: permiso.horSolicitadas,

      // Saldo actual del empleado, no el ID del registro
      horasDisponibles:
        mapaSaldos.get(permiso.emailInstitucional.trim().toLowerCase()) ?? '00:00:00',

      motivo: permiso.motivo,
      emergencia: permiso.catEmergencia ?? false,

      estado: permiso.estadoSolicitud?.nomEstado ?? 'SIN ESTADO',

      procesadoPor: permiso.priAprobacion,
      segundaAprobacion: permiso.segAprobacion,
      motivoRechazo: permiso.motRechazo,
    }));
  }

  /**
   * Segunda aprobación de permiso personal: Recursos Humanos.
   * Requiere que el Jefe Inmediato haya aprobado previamente.
   */
  async aprobarPermisoPersonal(idPermisoPersonal: string, emailAprobador: string) {
    const permiso = await this.permisoPersonalRepo.findOne({
      where: { idPermisoPersonal },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso personal ${idPermisoPersonal} no encontrado`);
    }

    const estadoEnProceso = await this.obtenerEstadoPorNombre('EN PROCESO');
    const estadoAprobado = await this.obtenerEstadoPorNombre('APROBADO');

    if (permiso.idEstadoSolicitud !== estadoEnProceso.idEstadoSolicitud) {
      throw new BadRequestException('El permiso no se encuentra en estado EN PROCESO');
    }

    if (!permiso.priAprobacion?.trim()) {
      throw new BadRequestException('El permiso todavía no ha sido aprobado por el Jefe Inmediato');
    }

    if (permiso.segAprobacion?.trim()) {
      throw new BadRequestException('El permiso ya cuenta con la segunda aprobación');
    }

    if (permiso.priAprobacion.trim().toLowerCase() === emailAprobador.trim().toLowerCase()) {
      throw new BadRequestException(
        'El Jefe Inmediato no puede realizar también la aprobación de Recursos Humanos',
      );
    }

    const resultado = await this.dataSource.query(
      `
      UPDATE rrhh.permisos_personales
      SET
        segaprobacion = $2,
        idestadosolicitud = $3::uuid,
        motrechazo = NULL,
        actualizadoen = CURRENT_DATE,
        actualizadopor = $2
      WHERE idpermisopersonal = $1::uuid
        AND idestadosolicitud = $4::uuid
        AND priaprobacion IS NOT NULL
        AND TRIM(priaprobacion) <> ''
        AND segaprobacion IS NULL
      RETURNING idpermisopersonal
    `,
      [
        idPermisoPersonal,
        emailAprobador.trim(),
        estadoAprobado.idEstadoSolicitud,
        estadoEnProceso.idEstadoSolicitud,
      ],
    );

    if (!resultado || resultado.length === 0) {
      throw new BadRequestException(
        'No se pudo completar la aprobación de Recursos Humanos. Verifique el estado y las aprobaciones del permiso.',
      );
    }

    return this.permisoPersonalRepo.findOne({
      where: { idPermisoPersonal },
      relations: {
        estadoSolicitud: true,
      },
    });
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
