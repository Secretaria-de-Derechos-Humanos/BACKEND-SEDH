import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CrearSolicitudVacacionesDto } from './dto/crear-solicitud-vacaciones.dto';
import { Vacaciones } from './entities/vacaciones.entity';
import { VacacionesSaldo } from './entities/vacaciones-saldo.entity';
import { HistorialVacaciones } from './entities/historial-vacaciones.entity';

// =========================================================
// INTERFACES
// =========================================================

interface DiasVacacionesRow {
  dias: number | string;
}

interface CruceVacacionesRow {
  existe: boolean;
}

interface EmpleadoVacacionesRow {
  idcargo: number | string;
  idtipocontratacion: string | null;
  tipocontratacion: string | null;
}

interface TipoSolicitudRow {
  idtiposolicitud: string;
}

interface EstadoVacacionesRow {
  idestadosolicitud: string;
  nomestado: string;
}

interface DatosLaboralesVacacionesRow {
  idusuario: string;
  emailinstitucional: string;
  fecinglaborar: string | Date;
  idtipocontratacion: string;
  tipocontratacion: string;
}

interface SaldoVacacionesCalculado {
  diasAsignados: number;
  tipoContratacion: string;
  fechaIngreso: string;
  antiguedadAnios: number;
  mesesGenerados?: number;
}

interface SaldoPeriodoVacaciones {
  anio: number;
  diasAsignados: number;
  diasUtilizados: number;
  diasReservados: number;
  diasDisponibles: number;
}

// =========================================================
// INTERFAZ REPORTE DE VACACIONES
// =========================================================

interface ReporteVacacionesRow {
  idusuario: string;
  numidentidad: string;
  nombrecompleto: string;
  tipocontratacion: string | null;
  anio: number | null;
  diasasignados: number | string;
  diasutilizados: number | string;
  diasreservados: number | string;
  diasdisponibles: number | string;
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class VacacionesService {
  constructor(
    @InjectRepository(Vacaciones)
    private readonly vacacionesRepo: Repository<Vacaciones>,

    @InjectRepository(VacacionesSaldo)
    private readonly saldoRepo: Repository<VacacionesSaldo>,

    @InjectRepository(HistorialVacaciones)
    private readonly historialRepo: Repository<HistorialVacaciones>,

    private readonly dataSource: DataSource,
  ) {}

  // =========================================================
  // CALCULAR DÍAS QUE LE CORRESPONDEN AL EMPLEADO
  // =========================================================

  private async calcularAsignacionVacaciones(idUsuario: string): Promise<SaldoVacacionesCalculado> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          e.idusuario,
          e.emailinstitucional,
          e.fecinglaborar,
          e.idtipocontratacion,
          UPPER(TRIM(tc.nombre)) AS tipocontratacion
        FROM rrhh.empleados e
        INNER JOIN rrhh.tipos_contrataciones tc
          ON tc.idtipocontratacion =
             e.idtipocontratacion
        WHERE e.idusuario = $1::uuid
        LIMIT 1
        `,
      [idUsuario],
    )) as DatosLaboralesVacacionesRow[];
    const empleado = rows[0];
    if (!empleado) {
      throw new NotFoundException('No se encontró información laboral del empleado');
    }
    if (!empleado.fecinglaborar) {
      throw new BadRequestException('El empleado no tiene fecha de ingreso registrada');
    }
    const fechaIngreso = new Date(empleado.fecinglaborar);
    if (fechaIngreso.getFullYear() <= 1900) {
      throw new BadRequestException(
        'La fecha de ingreso del empleado debe ser actualizada antes de calcular sus vacaciones',
      );
    }
    const hoy = new Date();
    if (fechaIngreso > hoy) {
      throw new BadRequestException('La fecha de ingreso del empleado no puede ser futura');
    }
    const tipo = String(empleado.tipocontratacion).trim().toUpperCase();

    // =====================================================
    // ACUERDO
    // =====================================================

    if (tipo === 'ACUERDO') {
      let antiguedad = hoy.getFullYear() - fechaIngreso.getFullYear();

      const aniversario = new Date(
        hoy.getFullYear(),
        fechaIngreso.getMonth(),
        fechaIngreso.getDate(),
      );

      if (hoy < aniversario) {
        antiguedad--;
      }
      antiguedad = Math.max(antiguedad, 0);
      let diasAsignados = 0;

      if (antiguedad >= 6) {
        diasAsignados = 30;
      } else if (antiguedad === 5) {
        diasAsignados = 26;
      } else if (antiguedad === 4) {
        diasAsignados = 22;
      } else if (antiguedad === 3) {
        diasAsignados = 18;
      } else if (antiguedad === 2) {
        diasAsignados = 15;
      } else if (antiguedad === 1) {
        diasAsignados = 12;
      }
      return {
        diasAsignados,
        tipoContratacion: 'ACUERDO',
        fechaIngreso: fechaIngreso.toISOString().slice(0, 10),
        antiguedadAnios: antiguedad,
      };
    }

    // =====================================================
    // CONTRATO
    // =====================================================

    if (tipo === 'CONTRATO') {
      const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
      const inicioCalculo = fechaIngreso > inicioAnio ? fechaIngreso : inicioAnio;
      let meses =
        (hoy.getFullYear() - inicioCalculo.getFullYear()) * 12 +
        (hoy.getMonth() - inicioCalculo.getMonth());
      if (hoy.getDate() >= inicioCalculo.getDate()) {
        meses++;
      }
      meses = Math.max(0, Math.min(meses, 12));
      let antiguedad = hoy.getFullYear() - fechaIngreso.getFullYear();
      const aniversario = new Date(
        hoy.getFullYear(),
        fechaIngreso.getMonth(),
        fechaIngreso.getDate(),
      );
      if (hoy < aniversario) {
        antiguedad--;
      }
      return {
        diasAsignados: meses,
        tipoContratacion: 'CONTRATO',
        fechaIngreso: fechaIngreso.toISOString().slice(0, 10),
        antiguedadAnios: Math.max(antiguedad, 0),
        mesesGenerados: meses,
      };
    }

    throw new BadRequestException(`Tipo de contratación no reconocido: ${tipo}`);
  }

  // =========================================================
  // PERÍODOS DE ACUERDO
  // =========================================================

  private async obtenerPeriodosAcuerdo(idUsuario: string): Promise<SaldoPeriodoVacaciones[]> {
    const anioActual = new Date().getFullYear();
    const saldos = await this.saldoRepo.find({
      where: {
        idUsuario,
        activo: true,
      },
      order: {
        anio: 'DESC',
      },
    });

    return saldos
      .filter((saldo) => saldo.anio === anioActual || saldo.anio === anioActual - 1)
      .map((saldo) => {
        const asignados = Number(saldo.diasAsignados ?? 0);
        const utilizados = Number(saldo.diasUtilizados ?? 0);
        const reservados = Number(saldo.diasReservados ?? 0);

        return {
          anio: saldo.anio,
          diasAsignados: asignados,
          diasUtilizados: utilizados,
          diasReservados: reservados,
          diasDisponibles: Math.max(0, asignados - utilizados - reservados),
        };
      });
  }

  // =========================================================
  // OBTENER ESTADO
  // =========================================================

  private async obtenerEstado(nombre: string): Promise<EstadoVacacionesRow> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          idestadosolicitud,
          nomestado
        FROM rrhh.estados_solicitudes
        WHERE UPPER(TRIM(nomestado))
          =
          UPPER(TRIM($1))
        LIMIT 1
        `,
      [nombre],
    )) as EstadoVacacionesRow[];
    const estado = rows[0];
    if (!estado) {
      throw new NotFoundException(`No está configurado el estado ${nombre}`);
    }
    return estado;
  }

  // =========================================================
  // OBTENER MI SALDO
  // =========================================================

  async obtenerMiSaldo(idUsuario: string) {
    const anioActual = new Date().getFullYear();
    const calculo = await this.calcularAsignacionVacaciones(idUsuario);
    let saldo = await this.saldoRepo.findOne({
      where: {
        idUsuario,
        anio: anioActual,
        activo: true,
      },
    });

    // =====================================================
    // CREAR SALDO SI NO EXISTE
    // =====================================================

    if (!saldo) {
      const nuevoSaldo = this.saldoRepo.create({
        idUsuario,
        anio: anioActual,
        diasAsignados: calculo.diasAsignados,
        diasUtilizados: 0,
        diasReservados: 0,
        observacion: `Saldo generado automáticamente - ${calculo.tipoContratacion}`,
        activo: true,
        creadoEn: new Date(),
        creadoPor: idUsuario,
        actualizadoEn: new Date(),
        actualizadoPor: idUsuario,
      });

      saldo = await this.saldoRepo.save(nuevoSaldo);
    } else {
      if (Number(saldo.diasAsignados) !== Number(calculo.diasAsignados)) {
        saldo.diasAsignados = calculo.diasAsignados;
        saldo.actualizadoEn = new Date();
        saldo.actualizadoPor = idUsuario;
        saldo = await this.saldoRepo.save(saldo);
      }
    }

    if (!saldo) {
      throw new NotFoundException('No se pudo obtener o crear el saldo de vacaciones');
    }

    // =====================================================
    // ACUERDO
    // =====================================================

    if (calculo.tipoContratacion === 'ACUERDO') {
      const periodos = await this.obtenerPeriodosAcuerdo(idUsuario);
      const periodoActual = periodos.find((periodo) => periodo.anio === anioActual);
      const periodoAnterior = periodos.find((periodo) => periodo.anio === anioActual - 1);
      const diasPeriodoActual = periodoActual?.diasDisponibles ?? 0;
      const diasPeriodoAnterior = periodoAnterior?.diasDisponibles ?? 0;
      const diasDisponibles = diasPeriodoAnterior + diasPeriodoActual;
      const diasAsignados =
        Number(periodoAnterior?.diasAsignados ?? 0) +
        Number(periodoActual?.diasAsignados ?? saldo.diasAsignados);

      const diasUtilizados =
        Number(periodoAnterior?.diasUtilizados ?? 0) +
        Number(periodoActual?.diasUtilizados ?? saldo.diasUtilizados);

      const diasReservados =
        Number(periodoAnterior?.diasReservados ?? 0) +
        Number(periodoActual?.diasReservados ?? saldo.diasReservados);

      return {
        idSaldoVacacion: saldo.idSaldoVacacion,
        anio: saldo.anio,
        tipoContratacion: calculo.tipoContratacion,
        fechaIngreso: calculo.fechaIngreso,
        antiguedadAnios: calculo.antiguedadAnios,
        mesesGenerados: null,
        periodoAnterior: periodoAnterior ? String(periodoAnterior.anio) : null,
        diasPeriodoAnterior,
        periodoActual: String(anioActual),
        diasPeriodoActual,
        diasAsignados,
        diasUtilizados,
        diasReservados,
        diasDisponibles,
      };
    }

    // =====================================================
    // CONTRATO
    // =====================================================

    const diasDisponibles = Math.max(
      0,
      Number(saldo.diasAsignados) - Number(saldo.diasUtilizados) - Number(saldo.diasReservados),
    );
    return {
      idSaldoVacacion: saldo.idSaldoVacacion,
      anio: saldo.anio,
      tipoContratacion: calculo.tipoContratacion,
      fechaIngreso: calculo.fechaIngreso,
      antiguedadAnios: calculo.antiguedadAnios,
      mesesGenerados: calculo.mesesGenerados ?? null,
      periodoAnterior: null,
      diasPeriodoAnterior: 0,
      periodoActual: String(anioActual),
      diasPeriodoActual: diasDisponibles,
      diasAsignados: Number(saldo.diasAsignados),
      diasUtilizados: Number(saldo.diasUtilizados),
      diasReservados: Number(saldo.diasReservados),
      diasDisponibles,
    };
  }

  // =========================================================
  // VALIDAR SALDO PARA SOLICITAR
  // =========================================================

  private async validarSaldoParaSolicitud(idUsuario: string): Promise<number> {
    const saldo = await this.obtenerMiSaldo(idUsuario);
    const diasDisponibles = Number(saldo?.diasDisponibles ?? 0);
    if (diasDisponibles <= 0) {
      throw new BadRequestException(
        'El empleado no tiene días de vacaciones disponibles para solicitar.',
      );
    }
    return diasDisponibles;
  }

  // =========================================================
  // REPORTE DE VACACIONES
  // =========================================================

  async obtenerReporteVacaciones(idUsuario: string, roles: number[], anio: number) {
    const tieneRolJefe = roles.includes(2);
    const tieneRolSubgerente = roles.includes(3);
    const tieneRolAdmin = roles.includes(5);
    if (!tieneRolJefe && !tieneRolSubgerente && !tieneRolAdmin) {
      throw new BadRequestException(
        'El usuario no tiene permisos para consultar el reporte de vacaciones',
      );
    }

    let whereJefe = '';

    const parametros: any[] = [anio];

    // =====================================================
    // ROL JEFE
    // =====================================================

    if (tieneRolJefe && !tieneRolSubgerente && !tieneRolAdmin) {
      whereJefe = `
        AND e.idsupinmediato = (
          SELECT
            numidentidad
          FROM rrhh.empleados
          WHERE idusuario = $2::uuid
          LIMIT 1
        )
      `;

      parametros.push(idUsuario);
    }

    // =====================================================
    // CONSULTA
    // =====================================================

    const rows = (await this.dataSource.query(
      `
        SELECT
          e.idusuario,
          e.numidentidad,
          TRIM(
            CONCAT_WS(
              ' ',
              e.prinombre,
              e.segnombre,
              e.priapellido,
              e.segapellido
            )
          ) AS nombrecompleto,

          UPPER(
            TRIM(tc.nombre)
          ) AS tipocontratacion,

          vs.anio,

          COALESCE(
            vs.diasasignados,
            0
          ) AS diasasignados,

          COALESCE(
            vs.diasutilizados,
            0
          ) AS diasutilizados,

          COALESCE(
            vs.diasreservados,
            0
          ) AS diasreservados,

          GREATEST(
            COALESCE(
              vs.diasasignados,
              0
            )
            -
            COALESCE(
              vs.diasutilizados,
              0
            )
            -
            COALESCE(
              vs.diasreservados,
              0
            ),
            0
          ) AS diasdisponibles

        FROM rrhh.empleados e

        LEFT JOIN rrhh.tipos_contrataciones tc
          ON tc.idtipocontratacion =
             e.idtipocontratacion

        LEFT JOIN rrhh.vacaciones_saldos vs
          ON vs.idusuario =
             e.idusuario
          AND vs.anio = $1
          AND vs.activo = true

        WHERE
          e.actlaboralmente = true

        ${whereJefe}

        ORDER BY
          e.prinombre,
          e.priapellido
        `,
      parametros,
    )) as ReporteVacacionesRow[];

    return {
      anio,
      totalEmpleados: rows.length,
      empleados: rows.map((row) => ({
        idUsuario: row.idusuario,
        identidad: row.numidentidad,
        nombreCompleto: row.nombrecompleto,
        tipoContratacion: row.tipocontratacion,
        anio: row.anio ?? anio,
        diasAsignados: Number(row.diasasignados),
        diasUtilizados: Number(row.diasutilizados),
        diasReservados: Number(row.diasreservados),
        diasDisponibles: Number(row.diasdisponibles),
      })),
    };
  }

  // =========================================================
  // CALCULAR DÍAS LABORABLES
  // =========================================================

  async calcularDias(fechaInicio: string, fechaFin: string): Promise<number> {
    if (!fechaInicio || !fechaFin) {
      throw new BadRequestException('Debe indicar la fecha inicial y la fecha final');
    }

    if (fechaFin < fechaInicio) {
      throw new BadRequestException('La fecha final no puede ser menor que la fecha inicial');
    }

    const rows = (await this.dataSource.query(
      `
        SELECT
          rrhh.calcular_dias_vacaciones(
            $1::date,
            $2::date
          ) AS dias
        `,
      [fechaInicio, fechaFin],
    )) as DiasVacacionesRow[];

    const dias = Number(rows?.[0]?.dias ?? 0);

    if (dias <= 0) {
      throw new BadRequestException('El período seleccionado no contiene días laborables');
    }

    return dias;
  }

  // =========================================================
  // MIS SOLICITUDES
  // =========================================================

  async obtenerMisSolicitudes(idUsuario: string) {
    return this.vacacionesRepo.find({
      where: {
        idUsuario,
      },

      order: {
        fecSolicitud: 'DESC',
      },

      relations: {
        tipoSolicitud: true,
        estadoSolicitud: true,
        cargo: true,
        tipoContratacion: true,
      },
    });
  }

  // =========================================================
  // PENDIENTES DEL JEFE INMEDIATO
  // =========================================================

  async obtenerSolicitudesPendientesJefe(idUsuario: string) {
    const estadoEnProceso = await this.obtenerEstado('EN PROCESO');

    const rows = await this.dataSource.query(
      `
        SELECT
          v.idpermisovaca,
          v.idusuario,
          v.emailinstitucional,
          v.fecsolicitud,
          v.fecinicial,
          v.fecfinal,
          v.cantvacaciones,
          v.idestadosolicitud,
          es.nomestado,
          v.priaprobacion,
          v.segaprobacion,
          v.motrechazo,
          v.cantperanterior,
          v.cantperactual,
          e.emailinstitucional AS email_empleado,
          e.prinombre,
          e.segnombre,
          e.priapellido,
          e.segapellido,
          e.numidentidad,
          e.idsupinmediato
        FROM rrhh.vacaciones v
        INNER JOIN rrhh.empleados e
          ON e.idusuario =
             v.idusuario

        LEFT JOIN rrhh.estados_solicitudes es
          ON es.idestadosolicitud =
             v.idestadosolicitud

        INNER JOIN rrhh.empleados j
          ON TRIM(j.numidentidad) =
             TRIM(e.idsupinmediato)

        WHERE

          j.idusuario =
          $1::uuid
          AND v.idestadosolicitud =
              $2::uuid
          AND v.priaprobacion IS NULL
          AND v.segaprobacion IS NULL
        ORDER BY
          v.fecsolicitud DESC
        `,
      [idUsuario, estadoEnProceso.idestadosolicitud],
    );

    return rows;
  }

  // =========================================================
  // CREAR SOLICITUD
  // =========================================================

  async crearSolicitud(idUsuario: string, email: string, dto: CrearSolicitudVacacionesDto) {
    // =====================================================
    // VALIDAR FECHAS
    // =====================================================

    if (!dto.fechaInicio || !dto.fechaFin) {
      throw new BadRequestException('Debe indicar la fecha inicial y la fecha final');
    }
    if (dto.fechaFin < dto.fechaInicio) {
      throw new BadRequestException('La fecha final no puede ser menor que la fecha inicial');
    }
    const hoy = new Date().toISOString().slice(0, 10);
    if (dto.fechaInicio < hoy) {
      throw new BadRequestException('No puede solicitar vacaciones para fechas anteriores');
    }

    // =====================================================
    // CALCULAR DÍAS
    // =====================================================

    const diasSolicitados = await this.calcularDias(dto.fechaInicio, dto.fechaFin);

    // =====================================================
    // VALIDAR SALDO
    // =====================================================

    const saldoDisponible = await this.validarSaldoParaSolicitud(idUsuario);

    if (diasSolicitados > saldoDisponible) {
      throw new BadRequestException(
        `Saldo insuficiente. Tiene ${saldoDisponible} días disponibles y está solicitando ${diasSolicitados}`,
      );
    }

    // =====================================================
    // VALIDAR CRUCE
    // =====================================================

    const cruceRows = (await this.dataSource.query(
      `
        SELECT
          rrhh.existe_cruce_vacaciones(
            $1::uuid,
            $2::date,
            $3::date,
            NULL
          ) AS existe
        `,
      [idUsuario, dto.fechaInicio, dto.fechaFin],
    )) as CruceVacacionesRow[];

    if (cruceRows?.[0]?.existe === true) {
      throw new BadRequestException(
        'Ya existe una solicitud de vacaciones que se cruza con esas fechas',
      );
    }

    // =====================================================
    // DATOS LABORALES
    // =====================================================

    const empleadoRows = (await this.dataSource.query(
      `
        SELECT

          e.idcargo,

          e.idtipocontratacion,

          UPPER(
            TRIM(tc.nombre)
          ) AS tipocontratacion

        FROM rrhh.empleados e

        LEFT JOIN rrhh.tipos_contrataciones tc
          ON tc.idtipocontratacion =
             e.idtipocontratacion

        WHERE

          LOWER(
            TRIM(
              e.emailinstitucional
            )
          )
          =
          LOWER(
            TRIM($1)
          )

        LIMIT 1
        `,
      [email],
    )) as EmpleadoVacacionesRow[];

    const empleado = empleadoRows[0];

    if (!empleado) {
      throw new NotFoundException('No se encontró información laboral para este usuario');
    }
    const tipoContratacion = String(empleado.tipocontratacion ?? '')
      .trim()
      .toUpperCase();

    // =====================================================
    // TIPO SOLICITUD
    // =====================================================

    const tipoRows = (await this.dataSource.query(
      `
        SELECT
          idtiposolicitud
        FROM rrhh.tipos_solicitudes_empleados
        WHERE
          UPPER(
            TRIM(nomtipo)
          ) = 'VACACIONES'
        LIMIT 1
        `,
    )) as TipoSolicitudRow[];

    const tipoSolicitud = tipoRows[0];

    if (!tipoSolicitud) {
      throw new NotFoundException('No está configurado el tipo de solicitud VACACIONES');
    }

    // =====================================================
    // ESTADO EN PROCESO
    // =====================================================

    const estadoEnProceso = await this.obtenerEstado('EN PROCESO');

    // =====================================================
    // TRANSACCIÓN
    // =====================================================

    return this.dataSource.transaction(async (manager) => {
      const vacacionesRepo = manager.getRepository(Vacaciones);

      const saldoRepo = manager.getRepository(VacacionesSaldo);

      const anioActual = new Date().getFullYear();

      // =================================================
      // SALDO ACTUAL
      // =================================================

      const saldoActual = await saldoRepo
        .createQueryBuilder('saldo')
        .setLock('pessimistic_write')
        .where('saldo.idUsuario = :idUsuario', {
          idUsuario,
        })
        .andWhere('saldo.anio = :anio', {
          anio: anioActual,
        })
        .andWhere('saldo.activo = true')
        .getOne();

      if (!saldoActual) {
        throw new NotFoundException('No se encontró el saldo actual de vacaciones');
      }

      // =================================================
      // SALDO ANTERIOR
      // =================================================

      let saldoAnterior: VacacionesSaldo | null = null;

      if (tipoContratacion === 'ACUERDO') {
        saldoAnterior = await saldoRepo
          .createQueryBuilder('saldo')
          .setLock('pessimistic_write')
          .where('saldo.idUsuario = :idUsuario', {
            idUsuario,
          })
          .andWhere('saldo.anio = :anio', {
            anio: anioActual - 1,
          })
          .andWhere('saldo.activo = true')
          .getOne();
      }

      const disponibleActual = Math.max(
        0,
        Number(saldoActual.diasAsignados) -
          Number(saldoActual.diasUtilizados) -
          Number(saldoActual.diasReservados),
      );

      const disponibleAnterior = saldoAnterior
        ? Math.max(
            0,
            Number(saldoAnterior.diasAsignados) -
              Number(saldoAnterior.diasUtilizados) -
              Number(saldoAnterior.diasReservados),
          )
        : 0;

      const totalDisponible =
        tipoContratacion === 'ACUERDO' ? disponibleAnterior + disponibleActual : disponibleActual;

      // =================================================
      // VALIDACIÓN DEFINITIVA
      // =================================================

      if (totalDisponible <= 0) {
        throw new BadRequestException(
          'El empleado no tiene días de vacaciones disponibles para solicitar.',
        );
      }

      if (diasSolicitados > totalDisponible) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponible actualmente: ${totalDisponible}`,
        );
      }

      // =================================================
      // DISTRIBUIR PERÍODOS
      // =================================================

      let diasPeriodoAnterior = 0;

      let diasPeriodoActual = diasSolicitados;

      if (tipoContratacion === 'ACUERDO' && saldoAnterior) {
        diasPeriodoAnterior = Math.min(diasSolicitados, disponibleAnterior);

        diasPeriodoActual = diasSolicitados - diasPeriodoAnterior;
      }

      // =================================================
      // RESERVAR ANTERIOR
      // =================================================

      if (saldoAnterior && diasPeriodoAnterior > 0) {
        saldoAnterior.diasReservados = Number(saldoAnterior.diasReservados) + diasPeriodoAnterior;

        saldoAnterior.actualizadoEn = new Date();

        saldoAnterior.actualizadoPor = idUsuario;

        await saldoRepo.save(saldoAnterior);
      }

      // =================================================
      // RESERVAR ACTUAL
      // =================================================

      if (diasPeriodoActual > 0) {
        saldoActual.diasReservados = Number(saldoActual.diasReservados) + diasPeriodoActual;

        saldoActual.actualizadoEn = new Date();

        saldoActual.actualizadoPor = idUsuario;

        await saldoRepo.save(saldoActual);
      }

      // =================================================
      // GUARDAR SOLICITUD
      // =================================================

      const solicitud = vacacionesRepo.create({
        idUsuario,

        idTipoSolicitud: tipoSolicitud.idtiposolicitud,

        emailInstitucional: email,

        fecSolicitud: new Date(),

        idEstadoSolicitud: estadoEnProceso.idestadosolicitud,

        idCargo: Number(empleado.idcargo),

        idTipoContratacion: empleado.idtipocontratacion ?? null,

        cantVacaciones: diasSolicitados,

        fecInicial: new Date(`${dto.fechaInicio}T00:00:00`),

        fecFinal: new Date(`${dto.fechaFin}T00:00:00`),

        fecRetorno: null,

        perAnterior: diasPeriodoAnterior > 0 ? String(anioActual - 1) : 'NO APLICA',

        cantPerAnterior: diasPeriodoAnterior,

        perActual: String(anioActual),

        cantPerActual: diasPeriodoActual,

        totDiasPeriodos: diasSolicitados,

        totDiasRestantes: totalDisponible - diasSolicitados,

        observaciones: dto.observaciones?.trim() ?? null,

        priAprobacion: null,

        segAprobacion: null,

        motRechazo: null,

        creadoPor: email,
      });

      const guardada = await vacacionesRepo.save(solicitud);

      return {
        message: 'Solicitud de vacaciones guardada con estado EN PROCESO',

        tipoContratacion,

        diasSolicitados,

        periodoAnterior: diasPeriodoAnterior > 0 ? anioActual - 1 : null,

        diasPeriodoAnterior,

        periodoActual: anioActual,

        diasPeriodoActual,

        diasDisponiblesAntes: totalDisponible,

        diasDisponiblesDespues: totalDisponible - diasSolicitados,

        solicitud: guardada,
      };
    });
  }

  // =========================================================
  // APROBACIÓN JEFE INMEDIATO
  // =========================================================

  async aprobarPorJefe(
    idPermisoVaca: string,
    idUsuarioAccion: string,
    emailAprobador: string,
    observacion?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const vacacionesRepo = manager.getRepository(Vacaciones);

      const historialRepo = manager.getRepository(HistorialVacaciones);

      const solicitud = await vacacionesRepo.findOne({
        where: {
          idPermisoVaca,
        },
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud de vacaciones no encontrada');
      }

      const estadoEnProceso = await this.obtenerEstado('EN PROCESO');

      if (solicitud.idEstadoSolicitud !== estadoEnProceso.idestadosolicitud) {
        throw new BadRequestException('La solicitud ya fue procesada');
      }

      // ✅ Propiedad de la entidad TypeORM
      if (solicitud.priAprobacion) {
        throw new BadRequestException('La solicitud ya fue aprobada por el Jefe Inmediato');
      }

      // ✅ Propiedad de la entidad TypeORM
      solicitud.priAprobacion = emailAprobador;

      solicitud.actualizadoEn = new Date();

      solicitud.actualizadoPor = emailAprobador;

      await vacacionesRepo.save(solicitud);

      const historial = historialRepo.create({
        idPermisoVaca,

        idUsuarioAccion,

        accion: 'APROBACION JEFE INMEDIATO',

        estadoAnterior: estadoEnProceso.idestadosolicitud,

        estadoNuevo: estadoEnProceso.idestadosolicitud,

        observacion: observacion?.trim() ?? null,

        fechaAccion: new Date(),
      });

      await historialRepo.save(historial);

      return {
        message: 'Solicitud aprobada por el Jefe Inmediato',

        idPermisoVaca,

        estado: 'EN PROCESO',

        primeraAprobacion: emailAprobador,
      };
    });
  }

  // =========================================================
  // PENDIENTES SUBGERENCIA
  // =========================================================

  async obtenerSolicitudesPendientesSubgerente() {
    const estadoEnProceso = await this.obtenerEstado('EN PROCESO');

    const rows = await this.dataSource.query(
      `
        SELECT

          v.idpermisovaca,

          v.idusuario,

          v.emailinstitucional,

          v.fecsolicitud,

          v.fecinicial,

          v.fecfinal,

          v.cantvacaciones,

          v.idestadosolicitud,

          es.nomestado,

          v.priaprobacion,

          v.segaprobacion,

          v.motrechazo,

          v.cantperanterior,

          v.cantperactual,

          e.prinombre,

          e.segnombre,

          e.priapellido,

          e.segapellido,

          e.numidentidad

        FROM rrhh.vacaciones v

        INNER JOIN rrhh.empleados e
          ON e.idusuario =
             v.idusuario

        LEFT JOIN rrhh.estados_solicitudes es
          ON es.idestadosolicitud =
             v.idestadosolicitud

        WHERE

          v.idestadosolicitud =
            $1::uuid

          AND v.priaprobacion IS NOT NULL

          AND v.segaprobacion IS NULL

        ORDER BY
          v.fecsolicitud DESC
        `,
      [estadoEnProceso.idestadosolicitud],
    );

    return rows;
  }

  // =========================================================
  // APROBACIÓN FINAL SUBGERENTE
  // =========================================================

  async aprobarPorSubgerente(
    idPermisoVaca: string,
    idUsuarioAccion: string,
    emailAprobador: string,
    observacion?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const vacacionesRepo = manager.getRepository(Vacaciones);

      const saldoRepo = manager.getRepository(VacacionesSaldo);

      const historialRepo = manager.getRepository(HistorialVacaciones);

      const solicitud = await vacacionesRepo.findOne({
        where: {
          idPermisoVaca,
        },
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud de vacaciones no encontrada');
      }

      const estadoEnProceso = await this.obtenerEstado('EN PROCESO');

      if (solicitud.idEstadoSolicitud !== estadoEnProceso.idestadosolicitud) {
        throw new BadRequestException('La solicitud no se encuentra EN PROCESO');
      }

      // ✅ Propiedad correcta
      if (!solicitud.priAprobacion) {
        throw new BadRequestException(
          'La solicitud todavía no ha sido aprobada por el Jefe Inmediato',
        );
      }

      // ✅ Propiedad correcta
      if (solicitud.segAprobacion) {
        throw new BadRequestException(
          'La solicitud ya fue aprobada por la Subgerencia de Recursos Humanos',
        );
      }

      const estadoAprobado = await this.obtenerEstado('APROBADO');

      // =================================================
      // PERÍODO ANTERIOR
      // =================================================

      const cantidadAnterior = Number(solicitud.cantPerAnterior ?? 0);

      if (cantidadAnterior > 0 && solicitud.perAnterior && solicitud.perAnterior !== 'NO APLICA') {
        const saldoAnterior = await saldoRepo
          .createQueryBuilder('saldo')
          .setLock('pessimistic_write')
          .where('saldo.idUsuario = :idUsuario', {
            idUsuario: solicitud.idUsuario,
          })
          .andWhere('saldo.anio = :anio', {
            anio: Number(solicitud.perAnterior),
          })
          .andWhere('saldo.activo = true')
          .getOne();

        if (!saldoAnterior) {
          throw new NotFoundException('No se encontró el saldo del período anterior');
        }

        if (Number(saldoAnterior.diasReservados) < cantidadAnterior) {
          throw new BadRequestException('El saldo reservado del período anterior es inconsistente');
        }

        saldoAnterior.diasReservados = Number(saldoAnterior.diasReservados) - cantidadAnterior;

        saldoAnterior.diasUtilizados = Number(saldoAnterior.diasUtilizados) + cantidadAnterior;

        saldoAnterior.actualizadoEn = new Date();

        saldoAnterior.actualizadoPor = idUsuarioAccion;

        await saldoRepo.save(saldoAnterior);
      }

      // =================================================
      // PERÍODO ACTUAL
      // =================================================

      const cantidadActual = Number(solicitud.cantPerActual ?? 0);

      if (cantidadActual > 0 && solicitud.perActual) {
        const saldoActual = await saldoRepo
          .createQueryBuilder('saldo')
          .setLock('pessimistic_write')
          .where('saldo.idUsuario = :idUsuario', {
            idUsuario: solicitud.idUsuario,
          })
          .andWhere('saldo.anio = :anio', {
            anio: Number(solicitud.perActual),
          })
          .andWhere('saldo.activo = true')
          .getOne();

        if (!saldoActual) {
          throw new NotFoundException('No se encontró el saldo del período actual');
        }

        if (Number(saldoActual.diasReservados) < cantidadActual) {
          throw new BadRequestException('El saldo reservado del período actual es inconsistente');
        }

        saldoActual.diasReservados = Number(saldoActual.diasReservados) - cantidadActual;

        saldoActual.diasUtilizados = Number(saldoActual.diasUtilizados) + cantidadActual;

        saldoActual.actualizadoEn = new Date();

        saldoActual.actualizadoPor = idUsuarioAccion;

        await saldoRepo.save(saldoActual);
      }

      // =================================================
      // CAMBIAR A APROBADO
      // =================================================

      const estadoAnterior = solicitud.idEstadoSolicitud;

      solicitud.idEstadoSolicitud = estadoAprobado.idestadosolicitud;

      // ✅ Propiedad correcta
      solicitud.segAprobacion = emailAprobador;

      solicitud.actualizadoEn = new Date();

      solicitud.actualizadoPor = emailAprobador;

      await vacacionesRepo.save(solicitud);

      const historial = historialRepo.create({
        idPermisoVaca,

        idUsuarioAccion,

        accion: 'APROBACION SUBGERENCIA RRHH',

        estadoAnterior,

        estadoNuevo: estadoAprobado.idestadosolicitud,

        observacion: observacion?.trim() ?? null,

        fechaAccion: new Date(),
      });

      await historialRepo.save(historial);

      return {
        message: 'Solicitud de vacaciones aprobada definitivamente',

        idPermisoVaca,

        estado: 'APROBADO',

        // ✅ Propiedad correcta
        primeraAprobacion: solicitud.priAprobacion,

        segundaAprobacion: emailAprobador,
      };
    });
  }

  // =========================================================
  // RECHAZAR VACACIONES
  // =========================================================

  async rechazarVacaciones(
    idPermisoVaca: string,
    idUsuarioAccion: string,
    emailUsuario: string,
    motivoRechazo: string,
  ) {
    if (!motivoRechazo?.trim()) {
      throw new BadRequestException('Debe indicar el motivo del rechazo');
    }

    return this.dataSource.transaction(async (manager) => {
      const vacacionesRepo = manager.getRepository(Vacaciones);

      const saldoRepo = manager.getRepository(VacacionesSaldo);

      const historialRepo = manager.getRepository(HistorialVacaciones);

      const solicitud = await vacacionesRepo.findOne({
        where: {
          idPermisoVaca,
        },
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud de vacaciones no encontrada');
      }

      const estadoAprobado = await this.obtenerEstado('APROBADO');

      const estadoRechazado = await this.obtenerEstado('RECHAZADO');

      if (solicitud.idEstadoSolicitud === estadoAprobado.idestadosolicitud) {
        throw new BadRequestException('La solicitud ya fue aprobada definitivamente');
      }

      if (solicitud.idEstadoSolicitud === estadoRechazado.idestadosolicitud) {
        throw new BadRequestException('La solicitud ya fue rechazada');
      }

      const estadoAnterior = solicitud.idEstadoSolicitud;

      // =================================================
      // LIBERAR PERÍODO ANTERIOR
      // =================================================

      const cantidadAnterior = Number(solicitud.cantPerAnterior ?? 0);

      if (cantidadAnterior > 0 && solicitud.perAnterior && solicitud.perAnterior !== 'NO APLICA') {
        const saldoAnterior = await saldoRepo
          .createQueryBuilder('saldo')
          .setLock('pessimistic_write')
          .where('saldo.idUsuario = :idUsuario', {
            idUsuario: solicitud.idUsuario,
          })
          .andWhere('saldo.anio = :anio', {
            anio: Number(solicitud.perAnterior),
          })
          .andWhere('saldo.activo = true')
          .getOne();

        if (saldoAnterior) {
          saldoAnterior.diasReservados = Math.max(
            0,
            Number(saldoAnterior.diasReservados) - cantidadAnterior,
          );

          saldoAnterior.actualizadoEn = new Date();

          saldoAnterior.actualizadoPor = idUsuarioAccion;

          await saldoRepo.save(saldoAnterior);
        }
      }

      // =================================================
      // LIBERAR PERÍODO ACTUAL
      // =================================================

      const cantidadActual = Number(solicitud.cantPerActual ?? 0);

      if (cantidadActual > 0 && solicitud.perActual) {
        const saldoActual = await saldoRepo
          .createQueryBuilder('saldo')
          .setLock('pessimistic_write')
          .where('saldo.idUsuario = :idUsuario', {
            idUsuario: solicitud.idUsuario,
          })
          .andWhere('saldo.anio = :anio', {
            anio: Number(solicitud.perActual),
          })
          .andWhere('saldo.activo = true')
          .getOne();

        if (saldoActual) {
          saldoActual.diasReservados = Math.max(
            0,
            Number(saldoActual.diasReservados) - cantidadActual,
          );

          saldoActual.actualizadoEn = new Date();

          saldoActual.actualizadoPor = idUsuarioAccion;

          await saldoRepo.save(saldoActual);
        }
      }

      // =================================================
      // ACTUALIZAR SOLICITUD
      // =================================================

      solicitud.idEstadoSolicitud = estadoRechazado.idestadosolicitud;

      solicitud.motRechazo = motivoRechazo.trim().slice(0, 100);

      solicitud.actualizadoEn = new Date();

      solicitud.actualizadoPor = emailUsuario;

      await vacacionesRepo.save(solicitud);

      // =================================================
      // HISTORIAL
      // =================================================

      const historial = historialRepo.create({
        idPermisoVaca,

        idUsuarioAccion,

        accion: 'RECHAZO VACACIONES',

        estadoAnterior,

        estadoNuevo: estadoRechazado.idestadosolicitud,

        observacion: motivoRechazo.trim(),

        fechaAccion: new Date(),
      });

      await historialRepo.save(historial);

      return {
        message: 'Solicitud de vacaciones rechazada',

        idPermisoVaca,

        estado: 'RECHAZADO',

        diasLiberados: cantidadAnterior + cantidadActual,
      };
    });
  }
}
