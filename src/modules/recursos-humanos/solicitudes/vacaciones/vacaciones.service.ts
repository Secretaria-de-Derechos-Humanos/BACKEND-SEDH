import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CrearSolicitudVacacionesDto } from './dto/crear-solicitud-vacaciones.dto';
import { CargaInicialSaldoDto } from './dto/carga-inicial-saldo.dto';
import { AjusteSaldoVacacionesDto } from './dto/ajuste-saldo-vacaciones.dto';
import { DescuentoMasivoVacacionesDto } from './dto/descuento-masivo-vacaciones.dto';
import { Vacaciones } from './entities/vacaciones.entity';
import { VacacionesSaldo } from './entities/vacaciones-saldo.entity';
import { HistorialVacaciones } from './entities/historial-vacaciones.entity';
import { NotificacionesService } from '../../notificaciones/notificaciones.service';

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

export interface ResultadoAjusteSaldo {
  message: string;
  tipo: 'AGREGAR' | 'DESCONTAR';
  dias: number;
  justificacion: string;
  saldo?: VacacionesSaldo;
  movimientos?: Array<{
    anio: number;
    dias: number;
  }>;
}

export interface ReporteEmpleadoVacaciones {
  idUsuario: string;
  identidad: string;
  nombreCompleto: string;
  tipoContratacion: string | null;
  anio: number;
  diasAsignados: number;
  diasUtilizados: number;
  diasReservados: number;
  diasDisponibles: number;
  saldoInicialPendiente: boolean;
}

interface ContextoVacaciones {
  tipoContratacion: 'ACUERDO' | 'CONTRATO' | 'INTERINATO';
  fechaIngreso: string;
  antiguedadAnios: number;
  anioPeriodoActual: number | null;
  diasDelPeriodoActual: number;
}

interface EmpleadoGestionVacacionesRow {
  idusuario: string;
  emailinstitucional: string;
  fecinglaborar: string | Date;
  tipocontratacion: string;
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

    private readonly notificacionesService: NotificacionesService,
  ) {}

  // =========================================================
  // CÁLCULO DE ASIGNACIÓN POR TIPO DE CONTRATACIÓN
  // =========================================================

  private obtenerDiasAcuerdoPorAntiguedad(antiguedadAnios: number): number {
    if (antiguedadAnios >= 6) return 30;
    if (antiguedadAnios === 5) return 26;
    if (antiguedadAnios === 4) return 22;
    if (antiguedadAnios === 3) return 18;
    if (antiguedadAnios === 2) return 15;
    if (antiguedadAnios === 1) return 12;
    return 0;
  }

  private calcularAntiguedad(fechaIngreso: Date, hoy = new Date()): number {
    let antiguedad = hoy.getFullYear() - fechaIngreso.getFullYear();

    const aniversario = new Date(
      hoy.getFullYear(),
      fechaIngreso.getMonth(),
      fechaIngreso.getDate(),
    );

    if (hoy < aniversario) {
      antiguedad--;
    }

    return Math.max(antiguedad, 0);
  }

  private calcularAnioPeriodoActual(fechaIngreso: Date, hoy = new Date()): number | null {
    const antiguedad = this.calcularAntiguedad(fechaIngreso, hoy);

    if (antiguedad < 1) {
      return null;
    }

    return fechaIngreso.getFullYear() + antiguedad;
  }

  private calcularMesesContrato(fechaIngreso: Date, hoy = new Date()): number {
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    const inicioCalculo = fechaIngreso > inicioAnio ? fechaIngreso : inicioAnio;

    let meses =
      (hoy.getFullYear() - inicioCalculo.getFullYear()) * 12 +
      (hoy.getMonth() - inicioCalculo.getMonth());

    if (hoy.getDate() >= inicioCalculo.getDate()) {
      meses++;
    }

    return Math.max(0, Math.min(meses, 12));
  }

  private async obtenerContextoVacaciones(idUsuario: string): Promise<ContextoVacaciones> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          e.idusuario,
          e.emailinstitucional,
          e.fecinglaborar,
          UPPER(TRIM(tc.nombre)) AS tipocontratacion
        FROM rrhh.empleados e
        INNER JOIN rrhh.tipos_contrataciones tc
          ON tc.idtipocontratacion = e.idtipocontratacion
        WHERE e.idusuario = $1::uuid
        LIMIT 1
      `,
      [idUsuario],
    )) as EmpleadoGestionVacacionesRow[];

    const empleado = rows[0];

    if (!empleado) {
      throw new NotFoundException('No se encontró información laboral del empleado');
    }

    if (!empleado.fecinglaborar) {
      throw new BadRequestException('El empleado no tiene fecha de ingreso registrada');
    }

    const fechaIngreso = new Date(empleado.fecinglaborar);

    if (Number.isNaN(fechaIngreso.getTime()) || fechaIngreso.getFullYear() <= 1900) {
      throw new BadRequestException(
        'La fecha de ingreso del empleado debe ser actualizada antes de calcular sus vacaciones',
      );
    }

    const hoy = new Date();

    if (fechaIngreso > hoy) {
      throw new BadRequestException('La fecha de ingreso del empleado no puede ser futura');
    }

    const tipo = String(empleado.tipocontratacion).trim().toUpperCase();

    if (tipo !== 'ACUERDO' && tipo !== 'CONTRATO' && tipo !== 'INTERINATO') {
      throw new BadRequestException(`Tipo de contratación no reconocido: ${tipo}`);
    }

    const antiguedadAnios = this.calcularAntiguedad(fechaIngreso, hoy);

    return {
      tipoContratacion: tipo,
      fechaIngreso: fechaIngreso.toISOString().slice(0, 10),
      antiguedadAnios,
      anioPeriodoActual:
        tipo === 'ACUERDO' ? this.calcularAnioPeriodoActual(fechaIngreso, hoy) : hoy.getFullYear(),
      diasDelPeriodoActual:
        tipo === 'ACUERDO'
          ? this.obtenerDiasAcuerdoPorAntiguedad(antiguedadAnios)
          : this.calcularMesesContrato(fechaIngreso, hoy),
    };
  }

  private async calcularAsignacionVacaciones(idUsuario: string): Promise<SaldoVacacionesCalculado> {
    const contexto = await this.obtenerContextoVacaciones(idUsuario);

    return {
      diasAsignados: contexto.diasDelPeriodoActual,
      tipoContratacion: contexto.tipoContratacion,
      fechaIngreso: contexto.fechaIngreso,
      antiguedadAnios: contexto.antiguedadAnios,
      mesesGenerados:
        contexto.tipoContratacion === 'CONTRATO' || contexto.tipoContratacion === 'INTERINATO'
          ? contexto.diasDelPeriodoActual
          : undefined,
    };
  }

  // =========================================================
  // CARGA Y MANTENIMIENTO DE CICLOS
  // =========================================================

  private obtenerAnosBloqueAcuerdo(antiguedadAnios: number): number[] {
    if (antiguedadAnios < 1) {
      return [];
    }

    if (antiguedadAnios === 1) {
      return [1];
    }

    return [antiguedadAnios - 1, antiguedadAnios];
  }

  private calcularAnioPeriodoPorAntiguedad(fechaIngreso: Date, antiguedadAnios: number): number {
    const fechaPeriodo = new Date(fechaIngreso);
    fechaPeriodo.setFullYear(fechaPeriodo.getFullYear() + antiguedadAnios);
    return fechaPeriodo.getFullYear();
  }
  private async registrarHistorialSaldo(
    manager: any,
    parametros: {
      idSaldoVacacion: string;
      idPermisoVaca?: string | null;
      idUsuarioAccion: string;
      accion: string;
      observacion: string;
      estadoAnterior?: string | null;
      estadoNuevo?: string | null;
    },
  ): Promise<void> {
    const historialRepo = manager.getRepository(HistorialVacaciones);

    const historial = historialRepo.create({
      idPermisoVaca: parametros.idPermisoVaca ?? null,
      idSaldoVacacion: parametros.idSaldoVacacion,
      idUsuarioAccion: parametros.idUsuarioAccion,
      accion: parametros.accion,
      estadoAnterior: parametros.estadoAnterior ?? null,
      estadoNuevo: parametros.estadoNuevo ?? null,
      observacion: parametros.observacion,
      fechaAccion: new Date(),
    });

    await historialRepo.save(historial);
  }

  private async vencerBloqueAnterior(
    manager: any,
    idUsuario: string,
    anioPeriodoActual: number,
    idUsuarioAccion: string,
  ): Promise<void> {
    const saldoRepo = manager.getRepository(VacacionesSaldo);

    // Cuando comienza un nuevo período a partir del tercer año,
    // vence únicamente el período que queda con dos años de antigüedad.
    //
    // Ejemplo:
    // Año 3 → vence Año 1
    // Año 4 → vence Año 2
    // Año 5 → vence Año 3
    // Año 6 → vence Año 4

    const anioVencido = anioPeriodoActual - 2;

    const saldoAnterior = await saldoRepo
      .createQueryBuilder('saldo')
      .setLock('pessimistic_write')
      .where('saldo.idUsuario = :idUsuario', {
        idUsuario,
      })
      .andWhere('saldo.activo = true')
      .andWhere('saldo.anio = :anioVencido', {
        anioVencido,
      })
      .getOne();

    if (!saldoAnterior) {
      return;
    }

    const disponibles = Math.max(
      0,
      Number(saldoAnterior.diasAsignados) -
        Number(saldoAnterior.diasUtilizados) -
        Number(saldoAnterior.diasReservados),
    );

    if (disponibles > 0) {
      await this.registrarHistorialSaldo(manager, {
        idSaldoVacacion: saldoAnterior.idSaldoVacacion,
        idUsuarioAccion,
        accion: 'VENCIMIENTO',
        observacion:
          `Vencimiento automático del saldo del período ` +
          `${saldoAnterior.anio} al iniciar el período ` +
          `${anioPeriodoActual}. ` +
          `Días vencidos: ${disponibles}.`,
      });
    }

    // El período deja de estar disponible para nuevas solicitudes.
    saldoAnterior.activo = false;
    saldoAnterior.actualizadoEn = new Date();
    saldoAnterior.actualizadoPor = idUsuarioAccion;

    await saldoRepo.save(saldoAnterior);
  }

  private async prepararCicloAcuerdo(idUsuario: string, idUsuarioAccion: string): Promise<void> {
    const contexto = await this.obtenerContextoVacaciones(idUsuario);

    if (contexto.tipoContratacion !== 'ACUERDO') {
      return;
    }

    const anioPeriodoActual = contexto.anioPeriodoActual;

    if (!anioPeriodoActual) {
      return;
    }

    const saldoRepo = this.saldoRepo;

    const saldosExistentes = await saldoRepo.find({
      where: {
        idUsuario,
        activo: true,
      },
      order: {
        anio: 'ASC',
      },
    });

    // La primera carga debe ser manual.
    if (saldosExistentes.length === 0) {
      return;
    }

    let ultimoAnio = Math.max(...saldosExistentes.map((saldo) => Number(saldo.anio)));

    // Ya tenemos generado el período actual.
    if (ultimoAnio >= anioPeriodoActual) {
      return;
    }

    const manager = this.dataSource.manager;

    for (let anio = ultimoAnio + 1; anio <= anioPeriodoActual; anio++) {
      const antiguedad = anio - new Date(contexto.fechaIngreso).getFullYear();

      if (antiguedad < 1) {
        continue;
      }

      // A partir del tercer año se vence únicamente
      // el período que tiene dos años de antigüedad.
      if (antiguedad >= 3) {
        await this.vencerBloqueAnterior(manager, idUsuario, anio, idUsuarioAccion);
      }

      const yaExiste = await saldoRepo.findOne({
        where: {
          idUsuario,
          anio,
          activo: true,
        },
      });

      if (yaExiste) {
        continue;
      }

      const diasAsignados = this.obtenerDiasAcuerdoPorAntiguedad(antiguedad);

      const nuevoSaldo = saldoRepo.create({
        idUsuario,
        anio,
        diasAsignados,
        diasUtilizados: 0,
        diasReservados: 0,
        observacion:
          `Asignación automática del período ${anio} ` +
          `por aniversario laboral. ` +
          `Antigüedad: ${antiguedad} año(s).`,
        activo: true,
        creadoEn: new Date(),
        creadoPor: idUsuarioAccion,
        actualizadoEn: new Date(),
        actualizadoPor: idUsuarioAccion,
      });

      const guardado = await saldoRepo.save(nuevoSaldo);

      await this.registrarHistorialSaldo(manager, {
        idSaldoVacacion: guardado.idSaldoVacacion,
        idUsuarioAccion,
        accion: 'ASIGNACION_ANUAL',
        observacion:
          `Asignación automática de ` +
          `${diasAsignados} día(s) ` +
          `correspondiente al aniversario laboral ` +
          `del período ${anio}.`,
      });

      ultimoAnio = anio;
    }
  }

  private async prepararCicloContrato(idUsuario: string, idUsuarioAccion: string): Promise<void> {
    const contexto = await this.obtenerContextoVacaciones(idUsuario);

    if (contexto.tipoContratacion !== 'CONTRATO') {
      return;
    }

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

    if (saldos.length === 0) {
      return;
    }

    const saldoActual = saldos.find((saldo) => Number(saldo.anio) === anioActual);

    if (saldoActual) {
      return;
    }

    const diasAsignados = this.calcularMesesContrato(new Date(contexto.fechaIngreso), new Date());

    const nuevoSaldo = this.saldoRepo.create({
      idUsuario,
      anio: anioActual,
      diasAsignados,
      diasUtilizados: 0,
      diasReservados: 0,
      observacion:
        `Asignación automática para CONTRATO del año ${anioActual}. ` +
        `Acumulación deshabilitada.`,
      activo: true,
      creadoEn: new Date(),
      creadoPor: idUsuarioAccion,
      actualizadoEn: new Date(),
      actualizadoPor: idUsuarioAccion,
    });

    const guardado = await this.saldoRepo.save(nuevoSaldo);

    await this.registrarHistorialSaldo(this.dataSource.manager, {
      idSaldoVacacion: guardado.idSaldoVacacion,
      idUsuarioAccion,
      accion: 'ASIGNACION_ANUAL',
      observacion:
        `Asignación de ${diasAsignados} día(s) para CONTRATO ` +
        `según meses trabajados en ${anioActual}.`,
    });
  }
  private async prepararCicloInterinato(idUsuario: string, idUsuarioAccion: string): Promise<void> {
    const contexto = await this.obtenerContextoVacaciones(idUsuario);

    if (contexto.tipoContratacion !== 'INTERINATO') {
      return;
    }

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

    // Si no existe saldo inicial, RRHH debe cargarlo manualmente.
    if (saldos.length === 0) {
      return;
    }

    const saldoActual = saldos.find((saldo) => Number(saldo.anio) === anioActual);

    if (saldoActual) {
      return;
    }

    // INTERINATO:
    // 1 día de vacaciones por cada mes trabajado
    // durante el año actual.
    const diasAsignados = this.calcularMesesContrato(new Date(contexto.fechaIngreso), new Date());

    const nuevoSaldo = this.saldoRepo.create({
      idUsuario,
      anio: anioActual,
      diasAsignados,
      diasUtilizados: 0,
      diasReservados: 0,
      observacion:
        `Asignación automática para INTERINATO del año ${anioActual}. ` +
        `1 día por cada mes trabajado.`,
      activo: true,
      creadoEn: new Date(),
      creadoPor: idUsuarioAccion,
      actualizadoEn: new Date(),
      actualizadoPor: idUsuarioAccion,
    });

    const guardado = await this.saldoRepo.save(nuevoSaldo);

    await this.registrarHistorialSaldo(this.dataSource.manager, {
      idSaldoVacacion: guardado.idSaldoVacacion,
      idUsuarioAccion,
      accion: 'ASIGNACION_ANUAL',
      observacion:
        `Asignación de ${diasAsignados} día(s) para INTERINATO ` +
        `según meses trabajados en ${anioActual}.`,
    });
  }
  private async prepararCicloVacaciones(idUsuario: string, idUsuarioAccion: string): Promise<void> {
    await this.prepararCicloAcuerdo(idUsuario, idUsuarioAccion);
    await this.prepararCicloContrato(idUsuario, idUsuarioAccion);
    await this.prepararCicloInterinato(idUsuario, idUsuarioAccion);
  }

  // =========================================================
  // OBTENER PERIODOS DE ACUERDO
  // =========================================================

  private async obtenerPeriodosAcuerdo(idUsuario: string): Promise<SaldoPeriodoVacaciones[]> {
    const contexto = await this.obtenerContextoVacaciones(idUsuario);

    if (contexto.tipoContratacion !== 'ACUERDO' || !contexto.anioPeriodoActual) {
      return [];
    }
    const antiguedad = contexto.antiguedadAnios;
    const anosBloque = this.obtenerAnosBloqueAcuerdo(antiguedad);
    const anosPeriodo = anosBloque.map((edad) =>
      this.calcularAnioPeriodoPorAntiguedad(new Date(contexto.fechaIngreso), edad),
    );

    const saldos = await this.saldoRepo.find({
      where: {
        idUsuario,
        activo: true,
      },
      order: {
        anio: 'ASC',
      },
    });

    return saldos
      .filter((saldo) => anosPeriodo.includes(Number(saldo.anio)))
      .map((saldo) => {
        const asignados = Number(saldo.diasAsignados ?? 0);
        const utilizados = Number(saldo.diasUtilizados ?? 0);
        const reservados = Number(saldo.diasReservados ?? 0);

        return {
          anio: Number(saldo.anio),
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
    const calculo = await this.calcularAsignacionVacaciones(idUsuario);

    // No se crea saldo inicial automáticamente.
    // RRHH debe realizar la carga inicial.
    await this.prepararCicloVacaciones(idUsuario, idUsuario);

    const contexto = await this.obtenerContextoVacaciones(idUsuario);

    if (contexto.tipoContratacion === 'ACUERDO') {
      const periodos = await this.obtenerPeriodosAcuerdo(idUsuario);

      if (periodos.length === 0) {
        return {
          idSaldoVacacion: null,
          anio: contexto.anioPeriodoActual,
          tipoContratacion: calculo.tipoContratacion,
          fechaIngreso: calculo.fechaIngreso,
          antiguedadAnios: calculo.antiguedadAnios,
          mesesGenerados: null,
          periodoAnterior: null,
          diasPeriodoAnterior: 0,
          periodoActual: contexto.anioPeriodoActual ? String(contexto.anioPeriodoActual) : null,
          diasPeriodoActual: 0,
          diasAsignados: 0,
          diasUtilizados: 0,
          diasReservados: 0,
          diasDisponibles: 0,
          saldoInicialPendiente: true,
        };
      }

      const periodoActual = periodos[periodos.length - 1];
      const periodoAnterior = periodos.length > 1 ? periodos[periodos.length - 2] : null;
      const diasDisponibles =
        (periodoAnterior?.diasDisponibles ?? 0) + periodoActual.diasDisponibles;
      const diasAsignados = (periodoAnterior?.diasAsignados ?? 0) + periodoActual.diasAsignados;
      const diasUtilizados = (periodoAnterior?.diasUtilizados ?? 0) + periodoActual.diasUtilizados;
      const diasReservados = (periodoAnterior?.diasReservados ?? 0) + periodoActual.diasReservados;
      const saldoInicialPendiente =
        periodoActual.diasAsignados === 0 &&
        periodoActual.diasUtilizados === 0 &&
        periodoActual.diasReservados === 0;

      return {
        idSaldoVacacion: null,
        anio: periodoActual.anio,
        tipoContratacion: calculo.tipoContratacion,
        fechaIngreso: calculo.fechaIngreso,
        antiguedadAnios: calculo.antiguedadAnios,
        mesesGenerados: null,
        periodoAnterior: periodoAnterior ? String(periodoAnterior.anio) : null,
        diasPeriodoAnterior: periodoAnterior?.diasDisponibles ?? 0,
        periodoActual: String(periodoActual.anio),
        diasPeriodoActual: periodoActual.diasDisponibles,
        diasAsignados,
        diasUtilizados,
        diasReservados,
        diasDisponibles,
        saldoInicialPendiente,
      };
    }

    const anioActual = new Date().getFullYear();
    const saldo = await this.saldoRepo.findOne({
      where: {
        idUsuario,
        anio: anioActual,
        activo: true,
      },
    });

    if (!saldo) {
      return {
        idSaldoVacacion: null,
        anio: anioActual,
        tipoContratacion: calculo.tipoContratacion,
        fechaIngreso: calculo.fechaIngreso,
        antiguedadAnios: calculo.antiguedadAnios,
        mesesGenerados: calculo.mesesGenerados ?? null,
        periodoAnterior: null,
        diasPeriodoAnterior: 0,
        periodoActual: String(anioActual),
        diasPeriodoActual: 0,
        diasAsignados: 0,
        diasUtilizados: 0,
        diasReservados: 0,
        diasDisponibles: 0,
        saldoInicialPendiente: true,
      };
    }

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
      saldoInicialPendiente: false,
    };
  }

  // =========================================================
  // CARGA INICIAL DE SALDO
  // =========================================================

  async cargarSaldoInicial(idUsuarioAccion: string, dto: CargaInicialSaldoDto) {
    const observacion = dto.observacion?.trim();

    if (!observacion) {
      throw new BadRequestException('La justificación de la carga inicial es obligatoria');
    }

    if (dto.diasUtilizados < 0 || dto.diasReservados < 0 || dto.diasAsignados < 0) {
      throw new BadRequestException('Los días no pueden tener valores negativos');
    }

    if (dto.diasUtilizados + dto.diasReservados > dto.diasAsignados) {
      throw new BadRequestException(
        'Los días utilizados y reservados no pueden superar los días asignados',
      );
    }

    const existente = await this.saldoRepo.findOne({
      where: {
        idUsuario: dto.idUsuario,
        anio: dto.anio,
      },
    });

    if (existente) {
      const saldoVacio =
        Number(existente.diasAsignados) === 0 &&
        Number(existente.diasUtilizados) === 0 &&
        Number(existente.diasReservados) === 0;

      if (!saldoVacio) {
        throw new BadRequestException(`Ya existe un saldo registrado para el período ${dto.anio}`);
      }

      return this.dataSource.transaction(async (manager) => {
        const saldoRepo = manager.getRepository(VacacionesSaldo);

        existente.diasAsignados = dto.diasAsignados;
        existente.diasUtilizados = dto.diasUtilizados;
        existente.diasReservados = dto.diasReservados;
        existente.observacion = observacion;
        existente.activo = true;
        existente.actualizadoEn = new Date();
        existente.actualizadoPor = idUsuarioAccion;

        const guardado = await saldoRepo.save(existente);

        await this.registrarHistorialSaldo(manager, {
          idSaldoVacacion: guardado.idSaldoVacacion,
          idUsuarioAccion,
          accion: 'EDITAR',
          observacion,
        });

        return {
          message: 'Saldo inicial registrado correctamente',
          saldo: guardado,
          diasDisponibles:
            Number(guardado.diasAsignados) -
            Number(guardado.diasUtilizados) -
            Number(guardado.diasReservados),
        };
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const saldoRepo = manager.getRepository(VacacionesSaldo);

      const saldo = saldoRepo.create({
        idUsuario: dto.idUsuario,
        anio: dto.anio,
        diasAsignados: dto.diasAsignados,
        diasUtilizados: dto.diasUtilizados,
        diasReservados: dto.diasReservados,
        observacion,
        activo: true,
        creadoEn: new Date(),
        creadoPor: idUsuarioAccion,
        actualizadoEn: new Date(),
        actualizadoPor: idUsuarioAccion,
      });

      const guardado = await saldoRepo.save(saldo);

      await this.registrarHistorialSaldo(manager, {
        idSaldoVacacion: guardado.idSaldoVacacion,
        idUsuarioAccion,
        accion: 'CREAR',
        observacion,
      });

      return {
        message: 'Saldo inicial registrado correctamente',
        saldo: guardado,
        diasDisponibles:
          Number(guardado.diasAsignados) -
          Number(guardado.diasUtilizados) -
          Number(guardado.diasReservados),
      };
    });
  }

  // =========================================================
  // AJUSTE INDIVIDUAL
  // =========================================================

  async ajustarSaldo(idUsuarioAccion: string, dto: AjusteSaldoVacacionesDto) {
    const justificacion = dto.justificacion?.trim();

    if (!justificacion) {
      throw new BadRequestException('La justificación es obligatoria para modificar el saldo');
    }

    if (dto.dias <= 0) {
      throw new BadRequestException('La cantidad de días debe ser mayor que cero');
    }

    await this.prepararCicloVacaciones(dto.idUsuario, idUsuarioAccion);

    const contexto = await this.obtenerContextoVacaciones(dto.idUsuario);

    return this.dataSource.transaction(async (manager) => {
      const saldoRepo = manager.getRepository(VacacionesSaldo);

      let saldos: VacacionesSaldo[] = [];

      if (contexto.tipoContratacion === 'ACUERDO') {
        const periodos = await this.obtenerPeriodosAcuerdo(dto.idUsuario);

        const anios = periodos.map((periodo) => periodo.anio);

        if (anios.length === 0) {
          throw new BadRequestException('El empleado no tiene saldo inicial de vacaciones cargado');
        }

        saldos = await saldoRepo
          .createQueryBuilder('saldo')
          .setLock('pessimistic_write')
          .where('saldo.idUsuario = :idUsuario', {
            idUsuario: dto.idUsuario,
          })
          .andWhere('saldo.activo = true')
          .andWhere('saldo.anio IN (:...anios)', {
            anios,
          })
          .orderBy('saldo.anio', 'ASC')
          .getMany();
      } else {
        const anioActual = new Date().getFullYear();

        const saldo = await saldoRepo
          .createQueryBuilder('saldo')
          .setLock('pessimistic_write')
          .where('saldo.idUsuario = :idUsuario', {
            idUsuario: dto.idUsuario,
          })
          .andWhere('saldo.anio = :anio', {
            anio: anioActual,
          })
          .andWhere('saldo.activo = true')
          .getOne();

        if (saldo) {
          saldos = [saldo];
        }
      }

      if (saldos.length === 0) {
        throw new BadRequestException(
          'El empleado no tiene un saldo de vacaciones cargado para modificar',
        );
      }

      if (dto.tipo === 'AGREGAR') {
        // Los aumentos se aplican al período más reciente.
        const saldo = saldos[saldos.length - 1];

        saldo.diasAsignados = Number(saldo.diasAsignados) + dto.dias;

        saldo.observacion =
          `${saldo.observacion ?? ''}\n` +
          `Ajuste manual: +${dto.dias} día(s). ${justificacion}`.trim();
        saldo.actualizadoEn = new Date();
        saldo.actualizadoPor = idUsuarioAccion;

        const guardado = await saldoRepo.save(saldo);

        await this.registrarHistorialSaldo(manager, {
          idSaldoVacacion: guardado.idSaldoVacacion,
          idUsuarioAccion,
          accion: 'AJUSTE_MANUAL',
          observacion: `Se agregaron ${dto.dias} día(s). ${justificacion}`,
        });

        return {
          message: 'Saldo ajustado correctamente',
          tipo: dto.tipo,
          dias: dto.dias,
          justificacion,
          saldo: guardado,
        };
      }

      let pendientes = dto.dias;
      const movimientos: Array<{
        anio: number;
        dias: number;
      }> = [];

      for (const saldo of saldos) {
        if (pendientes <= 0) break;

        const disponibles = Math.max(
          0,
          Number(saldo.diasAsignados) - Number(saldo.diasUtilizados) - Number(saldo.diasReservados),
        );

        const descontar = Math.min(pendientes, disponibles);

        if (descontar <= 0) continue;

        saldo.diasUtilizados = Number(saldo.diasUtilizados) + descontar;
        saldo.actualizadoEn = new Date();
        saldo.actualizadoPor = idUsuarioAccion;

        const guardado = await saldoRepo.save(saldo);

        await this.registrarHistorialSaldo(manager, {
          idSaldoVacacion: guardado.idSaldoVacacion,
          idUsuarioAccion,
          accion: 'DESCUENTO_MANUAL',
          observacion: `Se descontaron ${descontar} día(s). ${justificacion}`,
        });

        movimientos.push({
          anio: Number(saldo.anio),
          dias: descontar,
        });

        pendientes -= descontar;
      }

      if (pendientes > 0) {
        throw new BadRequestException(
          `Saldo insuficiente. Faltan ${pendientes} día(s) por descontar`,
        );
      }

      return {
        message: 'Descuento aplicado correctamente',
        tipo: dto.tipo,
        dias: dto.dias,
        justificacion,
        movimientos,
      };
    });
  }

  // =========================================================
  // DESCUENTO MASIVO
  // =========================================================

  async aplicarDescuentoMasivo(idUsuarioAccion: string, dto: DescuentoMasivoVacacionesDto) {
    const justificacion = dto.justificacion?.trim();

    if (!justificacion) {
      throw new BadRequestException('La justificación es obligatoria para el descuento masivo');
    }

    if (!dto.idUsuarios?.length) {
      throw new BadRequestException('Debe seleccionar al menos un empleado');
    }

    if (dto.dias <= 0) {
      throw new BadRequestException('La cantidad de días debe ser mayor que cero');
    }

    const resultados: Array<
      ResultadoAjusteSaldo & {
        idUsuario: string;
      }
    > = [];

    for (const idUsuario of dto.idUsuarios) {
      const resultado = await this.ajustarSaldo(idUsuarioAccion, {
        idUsuario,
        tipo: 'DESCONTAR',
        dias: dto.dias,
        justificacion,
      });

      resultados.push({
        idUsuario,
        ...resultado,
      });
    }

    return {
      message: 'Descuento masivo aplicado correctamente',
      totalEmpleados: resultados.length,
      diasPorEmpleado: dto.dias,
      justificacion,
      resultados,
    };
  }

  // =========================================================
  // HISTORIAL DE SALDO
  // =========================================================

  async obtenerHistorialSaldo(idUsuario: string) {
    const rows = await this.dataSource.query(
      `
        SELECT
          h.idhistorial,
          h.idpermisovaca,
          h.idsaldovacacion,
          h.idusuarioaccion,
          h.accion,
          h.observacion,
          h.fechaaccion
        FROM rrhh.historial_vacaciones h
        WHERE h.idsaldovacacion IN (
          SELECT vs.idsaldovacacion
          FROM rrhh.vacaciones_saldos vs
          WHERE vs.idusuario = $1::uuid
        )
        OR h.idpermisovaca IN (
          SELECT v.idpermisovaca
          FROM rrhh.vacaciones v
          WHERE v.idusuario = $1::uuid
        )
        ORDER BY h.fechaaccion DESC
      `,
      [idUsuario],
    );

    return rows;
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

  async obtenerReporteVacaciones(idUsuario: string, roles: number[], anio: number) {
    const tieneRolEmpleado = roles.includes(1);
    const tieneRolJefe = roles.includes(2);
    const tieneRolSubgerente = roles.includes(3);
    const tieneRolAdmin = roles.includes(5);
    const tieneRolVerificador = roles.includes(6);

    // -------------------------------------------------------
    // VALIDAR ACCESO AL REPORTE
    // -------------------------------------------------------

    if (
      !tieneRolEmpleado &&
      !tieneRolJefe &&
      !tieneRolSubgerente &&
      !tieneRolAdmin &&
      !tieneRolVerificador
    ) {
      throw new BadRequestException(
        'El usuario no tiene permisos para consultar el reporte de vacaciones',
      );
    }

    let whereAcceso = '';
    const parametros: any[] = [];

    // -------------------------------------------------------
    // ADMINISTRADOR, SUBGERENTE Y VERIFICADOR
    // -------------------------------------------------------
    // Pueden consultar todos los empleados.
    //
    // No agregamos ninguna condición al WHERE.
    // -------------------------------------------------------

    const puedeVerTodos = tieneRolAdmin || tieneRolSubgerente || tieneRolVerificador;

    if (!puedeVerTodos) {
      // -----------------------------------------------------
      // JEFE
      // -----------------------------------------------------
      // El jefe solamente puede consultar a sus subordinados.
      // -----------------------------------------------------

      if (tieneRolJefe) {
        whereAcceso = `
        AND e.idsupinmediato = (
          SELECT numidentidad
          FROM rrhh.empleados
          WHERE idusuario = $1::uuid
          LIMIT 1
        )
      `;

        parametros.push(idUsuario);
      }

      // -----------------------------------------------------
      // EMPLEADO NORMAL
      // -----------------------------------------------------
      // Solamente puede consultar su propio saldo.
      // -----------------------------------------------------
      else if (tieneRolEmpleado) {
        whereAcceso = `
        AND e.idusuario = $1::uuid
      `;

        parametros.push(idUsuario);
      }
    }

    // -------------------------------------------------------
    // OBTENER EMPLEADOS
    // -------------------------------------------------------

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
      UPPER(TRIM(tc.nombre)) AS tipocontratacion
    FROM rrhh.empleados e
    LEFT JOIN rrhh.tipos_contrataciones tc
      ON tc.idtipocontratacion =
         e.idtipocontratacion
    WHERE
      e.actlaboralmente = true
      ${whereAcceso}
    ORDER BY
      e.prinombre,
      e.priapellido
  `,
      parametros,
    )) as Array<{
      idusuario: string;
      numidentidad: string;
      nombrecompleto: string;
      tipocontratacion: string | null;
    }>;

    // -------------------------------------------------------
    // CALCULAR SALDO DE CADA EMPLEADO
    // -------------------------------------------------------

    const empleados: ReporteEmpleadoVacaciones[] = [];

    for (const row of rows) {
      try {
        // ---------------------------------------------------
        // INTENTAR PREPARAR EL CICLO Y OBTENER EL SALDO
        // ---------------------------------------------------

        await this.prepararCicloVacaciones(row.idusuario, idUsuario);

        const saldo = await this.obtenerMiSaldo(row.idusuario);

        empleados.push({
          idUsuario: row.idusuario,
          identidad: row.numidentidad,
          nombreCompleto: row.nombrecompleto,
          tipoContratacion: row.tipocontratacion,
          anio: saldo.anio ?? anio,
          diasAsignados: Number(saldo.diasAsignados ?? 0),
          diasUtilizados: Number(saldo.diasUtilizados ?? 0),
          diasReservados: Number(saldo.diasReservados ?? 0),
          diasDisponibles: Number(saldo.diasDisponibles ?? 0),
          saldoInicialPendiente: false,
        });
      } catch (error) {
        // ---------------------------------------------------
        // NO DEJAR QUE UN EMPLEADO DETENGA TODO EL REPORTE
        // ---------------------------------------------------

        console.warn(`No se pudo calcular vacaciones para el empleado ${row.idusuario}:`, error);

        empleados.push({
          idUsuario: row.idusuario,
          identidad: row.numidentidad,
          nombreCompleto: row.nombrecompleto,
          tipoContratacion: row.tipocontratacion,
          anio,
          diasAsignados: 0,
          diasUtilizados: 0,
          diasReservados: 0,
          diasDisponibles: 0,
          saldoInicialPendiente: true,
        });
      }
    }

    return {
      anio,
      totalEmpleados: empleados.length,
      empleados,
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
    // VALIDAR ANTICIPACIÓN MÍNIMA DE 5 DÍAS HÁBILES
    // =====================================================

    const fechaSolicitud = new Date(`${hoy}T00:00:00`);
    const fechaInicioVacaciones = new Date(`${dto.fechaInicio}T00:00:00`);

    let diasHabilesAnticipacion = 0;
    const fechaAuxiliar = new Date(fechaSolicitud);

    // No se cuenta el día de la solicitud.
    // Solo se cuentan lunes a viernes.
    while (fechaAuxiliar < fechaInicioVacaciones) {
      fechaAuxiliar.setDate(fechaAuxiliar.getDate() + 1);

      const diaSemana = fechaAuxiliar.getDay();

      if (diaSemana !== 0 && diaSemana !== 6) {
        diasHabilesAnticipacion++;
      }
    }

    if (diasHabilesAnticipacion < 5) {
      throw new BadRequestException(
        `Las vacaciones deben solicitarse con un mínimo de 5 días hábiles de anticipación. ` +
          `Actualmente solo tiene ${diasHabilesAnticipacion} día(s) hábil(es) de anticipación.`,
      );
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

      await this.prepararCicloVacaciones(idUsuario, idUsuario);

      const contexto = await this.obtenerContextoVacaciones(idUsuario);

      const anioActual = contexto.anioPeriodoActual ?? new Date().getFullYear();

      // =================================================
      // OBTENER PERÍODOS VIGENTES
      // =================================================

      const saldosVigentes = await saldoRepo
        .createQueryBuilder('saldo')
        .setLock('pessimistic_write')
        .where('saldo.idUsuario = :idUsuario', {
          idUsuario,
        })
        .andWhere('saldo.activo = true')
        .andWhere(
          contexto.tipoContratacion === 'ACUERDO'
            ? 'saldo.anio IN (:...anios)'
            : 'saldo.anio = :anioActual',
          contexto.tipoContratacion === 'ACUERDO'
            ? {
                anios: (await this.obtenerPeriodosAcuerdo(idUsuario)).map(
                  (periodo) => periodo.anio,
                ),
              }
            : {
                anioActual,
              },
        )
        .orderBy('saldo.anio', 'ASC')
        .getMany();

      if (saldosVigentes.length === 0) {
        throw new NotFoundException(
          'No se encontró saldo de vacaciones. Recursos Humanos debe registrar la carga inicial.',
        );
      }

      const disponibilidad = saldosVigentes.map((saldo) => ({
        saldo,
        disponible: Math.max(
          0,
          Number(saldo.diasAsignados) - Number(saldo.diasUtilizados) - Number(saldo.diasReservados),
        ),
      }));

      const totalDisponible = disponibilidad.reduce((total, item) => total + item.disponible, 0);

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

      // Consumimos primero el saldo más antiguo dentro del bloque.
      let pendientesDistribucion = diasSolicitados;
      const distribuciones: Array<{
        saldo: VacacionesSaldo;
        dias: number;
      }> = [];

      for (const item of disponibilidad) {
        if (pendientesDistribucion <= 0) break;

        const consumir = Math.min(pendientesDistribucion, item.disponible);

        if (consumir > 0) {
          item.saldo.diasReservados = Number(item.saldo.diasReservados) + consumir;

          item.saldo.actualizadoEn = new Date();
          item.saldo.actualizadoPor = idUsuario;

          await saldoRepo.save(item.saldo);

          distribuciones.push({
            saldo: item.saldo,
            dias: consumir,
          });

          pendientesDistribucion -= consumir;
        }
      }

      if (pendientesDistribucion > 0) {
        throw new BadRequestException(
          'No fue posible distribuir correctamente los días solicitados entre los períodos vigentes',
        );
      }

      const periodoAnterior = distribuciones.length > 1 ? distribuciones[0].saldo : null;

      const periodoActual = distribuciones[distribuciones.length - 1].saldo;

      const diasPeriodoAnterior = periodoAnterior ? distribuciones[0].dias : 0;

      const diasPeriodoActual =
        distribuciones.length === 1
          ? distribuciones[0].dias
          : distribuciones
              .filter((item) => item.saldo.idSaldoVacacion === periodoActual.idSaldoVacacion)
              .reduce((total, item) => total + item.dias, 0);

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

      // =====================================================
      // NOTIFICAR AL JEFE INMEDIATO
      // =====================================================
      try {
        const jefeRows = await this.dataSource.query(
          `
            SELECT
              u.idusuario,
              u.prinombre,
              u.priapellido,
              u.emailinstitucional,
              j.numidentidad
            FROM rrhh.empleados e
            INNER JOIN rrhh.empleados j
              ON TRIM(j.numidentidad) = TRIM(e.idsupinmediato)
            INNER JOIN core.usuarios u
              ON LOWER(TRIM(u.emailinstitucional)) = LOWER(TRIM(j.emailinstitucional))
            WHERE e.idusuario = $1::uuid
              AND e.idsupinmediato IS NOT NULL
            LIMIT 1
          `,
          [idUsuario],
        );

        const jefe = jefeRows?.[0];

        if (jefe?.idusuario) {
          await this.notificacionesService.crear(
            jefe.idusuario,
            'Nueva solicitud de vacaciones',
            `El empleado ${email} ha realizado una solicitud de vacaciones por ${diasSolicitados} día(s), desde ${dto.fechaInicio} hasta ${dto.fechaFin}.`,
            'VACACIONES',
            guardada.idPermisoVaca,
          );

          console.log('[NOTIFICACIONES] Notificación creada para jefe:', jefe.idusuario);
        } else {
          console.warn('[NOTIFICACIONES] No se encontró jefe inmediato para:', idUsuario);
        }
      } catch (error) {
        console.error('[NOTIFICACIONES] Error creando notificación:', error);
      }

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

      // =====================================================
      // 1. BUSCAR LA SOLICITUD
      // =====================================================

      const solicitud = await vacacionesRepo.findOne({
        where: {
          idPermisoVaca,
        },
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud de vacaciones no encontrada');
      }

      // =====================================================
      // 2. VALIDAR ESTADO
      // =====================================================

      const estadoEnProceso = await this.obtenerEstado('EN PROCESO');

      if (solicitud.idEstadoSolicitud !== estadoEnProceso.idestadosolicitud) {
        throw new BadRequestException('La solicitud ya fue procesada');
      }

      // =====================================================
      // 3. VALIDAR QUE TODAVÍA NO HAYA SIDO APROBADA
      // =====================================================

      if (solicitud.priAprobacion) {
        throw new BadRequestException('La solicitud ya fue aprobada por el Jefe Inmediato');
      }

      // =====================================================
      // 4. VALIDAR QUE EL USUARIO SEA EL JEFE INMEDIATO REAL
      // =====================================================

      const jefeRows = await manager.query(
        `
        SELECT 1
        FROM rrhh.empleados empleado
        INNER JOIN rrhh.empleados jefe
          ON TRIM(jefe.numidentidad) = TRIM(empleado.idsupinmediato)
        WHERE empleado.idusuario = $1::uuid
          AND jefe.idusuario = $2::uuid
        LIMIT 1
      `,
        [solicitud.idUsuario, idUsuarioAccion],
      );

      if (!jefeRows || jefeRows.length === 0) {
        throw new UnauthorizedException(
          'No tiene autorización para aprobar esta solicitud. El usuario autenticado no es el Jefe Inmediato del empleado.',
        );
      }

      // =====================================================
      // 5. REGISTRAR PRIMERA APROBACIÓN
      // =====================================================

      solicitud.priAprobacion = emailAprobador;

      solicitud.actualizadoEn = new Date();

      solicitud.actualizadoPor = emailAprobador;

      await vacacionesRepo.save(solicitud);

      // =====================================================
      // 6. REGISTRAR HISTORIAL
      // =====================================================

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

      // =====================================================
      // 7. RESPUESTA
      // =====================================================

      return {
        message: 'Solicitud aprobada por el Jefe Inmediato',

        idPermisoVaca,

        estado: 'EN PROCESO',

        primeraAprobacion: emailAprobador,
      };
    });
  }
  // =========================================================
  // ENCARGADO - SOLICITUDES PARA VERIFICAR SALDO
  // =========================================================

  async obtenerSolicitudesPendientesVerificacion() {
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
        e.numidentidad,

        e.emailinstitucional AS email_empleado,

        COALESCE(
          TRIM(e.prinombre) || ' ' ||
          TRIM(e.segnombre) || ' ' ||
          TRIM(e.priapellido) || ' ' ||
          TRIM(e.segapellido),
          e.emailinstitucional
        ) AS nombre_empleado

      FROM rrhh.vacaciones v

      INNER JOIN rrhh.empleados e
        ON e.idusuario = v.idusuario

      LEFT JOIN rrhh.estados_solicitudes es
        ON es.idestadosolicitud = v.idestadosolicitud

      WHERE
        v.idestadosolicitud = $1::uuid

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
  // ENCARGADO - VERIFICAR SALDO Y DAR VISTO BUENO
  // =========================================================

  async verificarSaldoYDarVistoBueno(
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
        throw new BadRequestException('La solicitud no se encuentra EN PROCESO');
      }

      /*
       * Primero debe haber sido aprobada
       * por el Jefe Inmediato.
       */
      if (!solicitud.priAprobacion) {
        throw new BadRequestException(
          'La solicitud todavía no ha sido aprobada por el Jefe Inmediato',
        );
      }

      /*
       * La aprobación final de Subgerencia
       * todavía no debe existir.
       */
      if (solicitud.segAprobacion) {
        throw new BadRequestException(
          'La solicitud ya fue procesada por la Subgerencia de Recursos Humanos',
        );
      }
      // =====================================================
      // VALIDAR VISTO BUENO DEL VERIFICADOR
      // =====================================================

      const verificacionRows = await manager.query(
        `
    SELECT 1
    FROM rrhh.historial_vacaciones h
    WHERE h.idpermisovaca = $1::uuid
      AND UPPER(TRIM(h.accion)) =
          'VERIFICACION Y VISTO BUENO DE SALDO'
    LIMIT 1
  `,
        [idPermisoVaca],
      );

      if (!verificacionRows || verificacionRows.length === 0) {
        throw new BadRequestException(
          'La solicitud todavía no ha sido verificada ni cuenta con visto bueno de saldo',
        );
      }

      /*
       * Obtener el saldo actual del empleado.
       */
      const saldoRows = await manager.query(
        `
        SELECT
          COALESCE(
            SUM(
              vs.diasasignados
              - vs.diasutilizados
              - vs.diasreservados
            ),
            0
          ) AS dias_disponibles

        FROM rrhh.vacaciones_saldos vs

        WHERE
          vs.idusuario = $1::uuid

          AND vs.activo = true
      `,
        [solicitud.idUsuario],
      );

      const diasDisponibles = Number(saldoRows?.[0]?.dias_disponibles ?? 0);

      const diasSolicitados = Number(solicitud.cantVacaciones ?? 0);

      /*
       * Validar nuevamente el saldo.
       */
      if (diasDisponibles < diasSolicitados) {
        throw new BadRequestException(
          `Saldo insuficiente. El empleado tiene ${diasDisponibles} día(s) disponibles y la solicitud requiere ${diasSolicitados} día(s).`,
        );
      }

      /*
       * Registrar el visto bueno en el historial.
       *
       * NO modificamos segAprobacion porque ese campo
       * pertenece a la aprobación final de Subgerencia.
       */
      const historial = historialRepo.create({
        idPermisoVaca,
        idUsuarioAccion,
        accion: 'VERIFICACION Y VISTO BUENO DE SALDO',
        estadoAnterior: estadoEnProceso.idestadosolicitud,
        estadoNuevo: estadoEnProceso.idestadosolicitud,
        observacion:
          observacion?.trim() ||
          `Saldo verificado correctamente. Días disponibles: ${diasDisponibles}. Días solicitados: ${diasSolicitados}.`,
        fechaAccion: new Date(),
      });

      await historialRepo.save(historial);

      /*
       * Buscar al empleado que realizó la solicitud
       * para poder notificarlo.
       */
      const empleadoRows = await manager.query(
        `
        SELECT
          u.idusuario

        FROM rrhh.vacaciones v

        INNER JOIN core.usuarios u
          ON LOWER(TRIM(u.emailinstitucional)) =
             LOWER(TRIM(v.emailinstitucional))

        WHERE
          v.idpermisovaca = $1::uuid

        LIMIT 1
      `,
        [idPermisoVaca],
      );

      const empleado = empleadoRows?.[0];

      /*
       * Notificar al empleado.
       */
      if (empleado?.idusuario) {
        try {
          await this.notificacionesService.crear(
            empleado.idusuario,
            'Vacaciones verificadas',
            `Su solicitud de vacaciones por ${diasSolicitados} día(s) fue verificada correctamente y recibió visto bueno de saldo.`,
            'VACACIONES',
            idPermisoVaca,
          );
        } catch (error) {
          console.error('[NOTIFICACIONES] Error notificando verificación de vacaciones:', error);
        }
      }

      return {
        message: 'Saldo de vacaciones verificado correctamente y visto bueno registrado',
        idPermisoVaca,
        estado: 'EN PROCESO',
        diasSolicitados,
        diasDisponibles,
        saldoSuficiente: true,
        vistoBueno: true,
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
        ON e.idusuario = v.idusuario

      LEFT JOIN rrhh.estados_solicitudes es
        ON es.idestadosolicitud = v.idestadosolicitud

      WHERE
        v.idestadosolicitud = $1::uuid

        AND v.priaprobacion IS NOT NULL

        AND v.segaprobacion IS NULL

        -- Debe existir el visto bueno del Verificador
        AND EXISTS (
          SELECT 1
          FROM rrhh.historial_vacaciones h
          WHERE h.idpermisovaca = v.idpermisovaca
            AND UPPER(TRIM(h.accion)) =
                'VERIFICACION Y VISTO BUENO DE SALDO'
        )

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
  // ANULAR SOLICITUD DE VACACIONES
  // =========================================================

  async anularVacaciones(idPermisoVaca: string, idUsuarioAccion: string) {
    return this.dataSource.transaction(async (manager) => {
      const vacacionesRepo = manager.getRepository(Vacaciones);

      const saldoRepo = manager.getRepository(VacacionesSaldo);

      const historialRepo = manager.getRepository(HistorialVacaciones);

      // -----------------------------------------------------
      // BUSCAR SOLICITUD
      // -----------------------------------------------------

      const solicitud = await vacacionesRepo.findOne({
        where: {
          idPermisoVaca,
        },
      });

      if (!solicitud) {
        throw new NotFoundException('Solicitud de vacaciones no encontrada');
      }

      // -----------------------------------------------------
      // VALIDAR QUE SEA DEL EMPLEADO AUTENTICADO
      // -----------------------------------------------------

      if (solicitud.idUsuario !== idUsuarioAccion) {
        throw new BadRequestException(
          'No puede anular una solicitud que pertenece a otro empleado',
        );
      }

      // -----------------------------------------------------
      // VALIDAR FECHA DE INICIO
      //
      // Solo se puede anular antes de que comience.
      // -----------------------------------------------------

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const fechaInicio = new Date(solicitud.fecInicial);

      fechaInicio.setHours(0, 0, 0, 0);

      if (fechaInicio <= hoy) {
        throw new BadRequestException(
          'La solicitud ya inició o la fecha de inicio es hoy. No puede ser anulada.',
        );
      }

      // -----------------------------------------------------
      // OBTENER ESTADOS
      // -----------------------------------------------------

      const estadoEnProceso = await this.obtenerEstado('EN PROCESO');

      const estadoAprobado = await this.obtenerEstado('APROBADO');

      const estadoAnulado = await this.obtenerEstado('ANULADO');

      // -----------------------------------------------------
      // VALIDAR ESTADO ACTUAL
      // -----------------------------------------------------

      const esEnProceso = solicitud.idEstadoSolicitud === estadoEnProceso.idestadosolicitud;

      const esAprobado = solicitud.idEstadoSolicitud === estadoAprobado.idestadosolicitud;

      if (!esEnProceso && !esAprobado) {
        throw new BadRequestException(
          'La solicitud no puede ser anulada porque ya fue rechazada, anulada o tiene un estado no permitido.',
        );
      }

      const estadoAnterior = solicitud.idEstadoSolicitud;

      // -----------------------------------------------------
      // CANTIDADES POR PERÍODO
      // -----------------------------------------------------

      const cantidadAnterior = Number(solicitud.cantPerAnterior ?? 0);

      const cantidadActual = Number(solicitud.cantPerActual ?? 0);

      // -----------------------------------------------------
      // EN PROCESO
      //
      // Se liberan los días reservados.
      // -----------------------------------------------------

      if (esEnProceso) {
        // -----------------------------------------------
        // PERÍODO ANTERIOR
        // -----------------------------------------------

        if (
          cantidadAnterior > 0 &&
          solicitud.perAnterior &&
          solicitud.perAnterior !== 'NO APLICA'
        ) {
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
            throw new BadRequestException(
              'El saldo reservado del período anterior es inconsistente',
            );
          }

          saldoAnterior.diasReservados = Number(saldoAnterior.diasReservados) - cantidadAnterior;

          saldoAnterior.actualizadoEn = new Date();

          saldoAnterior.actualizadoPor = idUsuarioAccion;

          await saldoRepo.save(saldoAnterior);
        }

        // -----------------------------------------------
        // PERÍODO ACTUAL
        // -----------------------------------------------

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

          saldoActual.actualizadoEn = new Date();

          saldoActual.actualizadoPor = idUsuarioAccion;

          await saldoRepo.save(saldoActual);
        }
      }

      // -----------------------------------------------------
      // APROBADO
      //
      // Los días ya estaban como utilizados.
      // Se devuelven al saldo.
      // -----------------------------------------------------

      if (esAprobado) {
        // -----------------------------------------------
        // PERÍODO ANTERIOR
        // -----------------------------------------------

        if (
          cantidadAnterior > 0 &&
          solicitud.perAnterior &&
          solicitud.perAnterior !== 'NO APLICA'
        ) {
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

          if (Number(saldoAnterior.diasUtilizados) < cantidadAnterior) {
            throw new BadRequestException(
              'El saldo utilizado del período anterior es inconsistente',
            );
          }

          saldoAnterior.diasUtilizados = Number(saldoAnterior.diasUtilizados) - cantidadAnterior;

          saldoAnterior.actualizadoEn = new Date();

          saldoAnterior.actualizadoPor = idUsuarioAccion;

          await saldoRepo.save(saldoAnterior);
        }

        // -----------------------------------------------
        // PERÍODO ACTUAL
        // -----------------------------------------------

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

          if (Number(saldoActual.diasUtilizados) < cantidadActual) {
            throw new BadRequestException('El saldo utilizado del período actual es inconsistente');
          }

          saldoActual.diasUtilizados = Number(saldoActual.diasUtilizados) - cantidadActual;

          saldoActual.actualizadoEn = new Date();

          saldoActual.actualizadoPor = idUsuarioAccion;

          await saldoRepo.save(saldoActual);
        }
      }

      // -----------------------------------------------------
      // CAMBIAR ESTADO A ANULADO
      // -----------------------------------------------------

      solicitud.idEstadoSolicitud = estadoAnulado.idestadosolicitud;

      solicitud.actualizadoEn = new Date();

      solicitud.actualizadoPor = idUsuarioAccion;

      await vacacionesRepo.save(solicitud);

      // -----------------------------------------------------
      // HISTORIAL
      // -----------------------------------------------------

      const historial = historialRepo.create({
        idPermisoVaca,
        idUsuarioAccion,
        accion: 'ANULACION VACACIONES',
        estadoAnterior,
        estadoNuevo: estadoAnulado.idestadosolicitud,
        observacion: 'Solicitud anulada por el empleado antes de iniciar el período solicitado.',
        fechaAccion: new Date(),
      });

      await historialRepo.save(historial);

      // -----------------------------------------------------
      // RESPUESTA
      // -----------------------------------------------------

      return {
        message: 'Solicitud de vacaciones anulada correctamente',
        idPermisoVaca,
        estado: 'ANULADO',
        diasDevueltos: cantidadAnterior + cantidadActual,
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

      // =========================================================
      // SEGURIDAD DE RECHAZO
      // =========================================================
      //
      // 1 = Empleado
      // 2 = Jefe Inmediato
      // 3 = Subgerencia RRHH
      // 5 = Administrador
      // 6 = Verificador de Vacaciones
      //
      // El usuario autenticado debe tener uno de estos roles.
      // Además, la etapa de la solicitud determina qué rol
      // puede realizar el rechazo.
      // =========================================================

      const usuarioRoles = await manager.query(
        `
      SELECT DISTINCT ur."idRol" AS "idRol"
      FROM seguridad."usuariosRoles" ur
      WHERE ur."idUsuario" = $1::uuid
      `,
        [idUsuarioAccion],
      );
      const rolesUsuario: number[] = usuarioRoles.map((item: any) => Number(item.idRol));

      // ---------------------------------------------------------
      // ADMINISTRADOR
      // ---------------------------------------------------------
      // El administrador conserva capacidad de gestión.
      // No bloqueamos los rechazos administrativos existentes.
      // ---------------------------------------------------------

      const esAdministrador = rolesUsuario.includes(5);

      // ---------------------------------------------------------
      // DETERMINAR ETAPA
      // ---------------------------------------------------------

      let etapa: 'JEFE' | 'VERIFICADOR' | 'SUBGERENCIA' | null = null;

      // ---------------------------------------------------------
      // ETAPA JEFE
      // ---------------------------------------------------------
      // Todavía no existe aprobación del jefe.
      // ---------------------------------------------------------

      if (!solicitud.priAprobacion && !solicitud.segAprobacion) {
        etapa = 'JEFE';
      }

      // ---------------------------------------------------------
      // ETAPA VERIFICADOR
      // ---------------------------------------------------------
      // El jefe ya aprobó, pero todavía no existe aprobación
      // secundaria/final.
      // ---------------------------------------------------------
      else if (solicitud.priAprobacion && !solicitud.segAprobacion) {
        etapa = 'VERIFICADOR';
      }

      // ---------------------------------------------------------
      // ETAPA SUBGERENCIA
      // ---------------------------------------------------------
      // Existe aprobación del jefe y también la verificación
      // de saldo/visto bueno.
      // ---------------------------------------------------------
      else if (solicitud.priAprobacion && solicitud.segAprobacion) {
        etapa = 'SUBGERENCIA';
      }

      // ---------------------------------------------------------
      // SI NO SE PUDO DETERMINAR LA ETAPA
      // ---------------------------------------------------------

      if (!etapa) {
        throw new UnauthorizedException('No se puede determinar la etapa actual de la solicitud');
      }

      // ---------------------------------------------------------
      // VERIFICAR HISTORIAL DE VISTO BUENO
      // ---------------------------------------------------------
      //
      // La verificación de saldo debe existir antes de permitir
      // una acción correspondiente a la etapa de Subgerencia.
      //
      // No modificamos el historial; solamente lo consultamos.
      // ---------------------------------------------------------

      let tieneVerificacionSaldo = false;

      if (solicitud.priAprobacion) {
        const verificacion = await manager.query(
          `
        SELECT 1
        FROM rrhh.historial_vacaciones
        WHERE "idPermisoVaca" = $1::uuid
          AND "accion" = 'VERIFICACION Y VISTO BUENO DE SALDO'
        LIMIT 1
        `,
          [idPermisoVaca],
        );

        tieneVerificacionSaldo = verificacion.length > 0;
      }

      // =========================================================
      // AUTORIZACIÓN SEGÚN ETAPA
      // =========================================================

      if (!esAdministrador) {
        // -------------------------------------------------------
        // JEFE
        // -------------------------------------------------------

        if (etapa === 'JEFE' && !rolesUsuario.includes(2)) {
          throw new UnauthorizedException(
            'No tiene permisos para rechazar esta solicitud como Jefe Inmediato',
          );
        }

        // -------------------------------------------------------
        // VERIFICADOR
        // -------------------------------------------------------

        if (etapa === 'VERIFICADOR' && !rolesUsuario.includes(6)) {
          throw new UnauthorizedException(
            'No tiene permisos para rechazar esta solicitud durante la verificación de vacaciones',
          );
        }

        // -------------------------------------------------------
        // SUBGERENCIA
        // -------------------------------------------------------

        if (etapa === 'SUBGERENCIA' && !rolesUsuario.includes(3)) {
          throw new UnauthorizedException(
            'No tiene permisos para realizar el rechazo final de vacaciones',
          );
        }
      }

      // ---------------------------------------------------------
      // SEGURIDAD ADICIONAL PARA SUBGERENCIA
      // ---------------------------------------------------------

      if (etapa === 'SUBGERENCIA' && !tieneVerificacionSaldo && !esAdministrador) {
        throw new BadRequestException(
          'La solicitud no cuenta con la verificación y visto bueno de saldo requerido',
        );
      }

      const estadoAnterior = solicitud.idEstadoSolicitud;

      // =========================================================
      // LIBERAR PERÍODO ANTERIOR
      // =========================================================

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

      // =========================================================
      // LIBERAR PERÍODO ACTUAL
      // =========================================================

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

      // =========================================================
      // ACTUALIZAR SOLICITUD
      // =========================================================

      solicitud.idEstadoSolicitud = estadoRechazado.idestadosolicitud;

      solicitud.motRechazo = motivoRechazo.trim().slice(0, 100);

      solicitud.actualizadoEn = new Date();

      solicitud.actualizadoPor = emailUsuario;

      await vacacionesRepo.save(solicitud);

      // =========================================================
      // HISTORIAL
      // =========================================================

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
