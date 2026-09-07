import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { Request } from 'express';

import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';

import { CrearSolicitudVacacionesDto } from './dto/crear-solicitud-vacaciones.dto';
import { AprobarVacacionesDto } from './dto/aprobar-vacaciones.dto';
import { RechazarVacacionesDto } from './dto/rechazar-vacaciones.dto';
import { CargaInicialSaldoDto } from './dto/carga-inicial-saldo.dto';
import { AjusteSaldoVacacionesDto } from './dto/ajuste-saldo-vacaciones.dto';
import { DescuentoMasivoVacacionesDto } from './dto/descuento-masivo-vacaciones.dto';

import { VacacionesService } from './vacaciones.service';

@ApiTags('Vacaciones')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rrhh/vacaciones')
export class VacacionesController {
  constructor(private readonly vacacionesService: VacacionesService) {}

  // =========================================================
  // USUARIO AUTENTICADO
  // =========================================================

  private obtenerUsuario(request: Request): {
    idUsuario: string;
    email: string;
    roles: number[];
  } {
    const user = request.user as {
      sub?: string;
      idUsuario?: string;
      email?: string;
      roles?: {
        r: number;
        m: number[];
      }[];
    };

    const idUsuario = user.idUsuario ?? user.sub;

    if (!idUsuario || !user.email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return {
      idUsuario,
      email: user.email,
      roles: (user.roles ?? []).map((rol) => Number(rol.r)),
    };
  }

  // =========================================================
  // AUTORIZACIÓN PARA GESTIÓN DE SALDOS
  // =========================================================

  private validarGestionVacaciones(request: Request): {
    idUsuario: string;
    email: string;
    roles: number[];
  } {
    const usuario = this.obtenerUsuario(request);

    // 3 = Subgerencia RRHH
    // 5 = Administrador

    const autorizado = usuario.roles.includes(3) || usuario.roles.includes(5);

    if (!autorizado) {
      throw new UnauthorizedException('No tiene permisos para administrar saldos de vacaciones');
    }

    return usuario;
  }
  // =========================================================
  // AUTORIZACIÓN PARA VERIFICACIÓN DE VACACIONES
  // =========================================================

  private validarVerificadorVacaciones(request: Request): {
    idUsuario: string;
    email: string;
    roles: number[];
  } {
    const usuario = this.obtenerUsuario(request);

    // 6 = Verificador Vacaciones
    // 5 = Administrador
    const autorizado = usuario.roles.includes(6) || usuario.roles.includes(5);

    if (!autorizado) {
      throw new UnauthorizedException('No tiene permisos para verificar el saldo de vacaciones');
    }

    return usuario;
  }
  // =========================================================
  // EMPLEADO - MI SALDO
  // =========================================================

  @Get('mi-saldo')
  @ApiOperation({
    summary: 'Consultar saldo de vacaciones del usuario autenticado',
  })
  obtenerMiSaldo(@Req() request: Request) {
    const usuario = this.obtenerUsuario(request);

    return this.vacacionesService.obtenerMiSaldo(usuario.idUsuario);
  }

  // =========================================================
  // EMPLEADO - CALCULAR DÍAS
  // =========================================================

  @Get('calcular-dias')
  @ApiOperation({
    summary: 'Calcular los días laborables de un período',
  })
  calcularDias(@Query('fechaInicio') fechaInicio: string, @Query('fechaFin') fechaFin: string) {
    return this.vacacionesService.calcularDias(fechaInicio, fechaFin);
  }

  // =========================================================
  // EMPLEADO - CREAR SOLICITUD
  // =========================================================

  @Post('solicitudes')
  @ApiOperation({
    summary: 'Crear una solicitud de vacaciones',
  })
  crearSolicitud(@Req() request: Request, @Body() body: CrearSolicitudVacacionesDto) {
    const usuario = this.obtenerUsuario(request);

    return this.vacacionesService.crearSolicitud(usuario.idUsuario, usuario.email, body);
  }

  // =========================================================
  // EMPLEADO - MIS SOLICITUDES
  // =========================================================

  @Get('mis-solicitudes')
  @ApiOperation({
    summary: 'Consultar mis solicitudes de vacaciones',
  })
  obtenerMisSolicitudes(@Req() request: Request) {
    const usuario = this.obtenerUsuario(request);

    return this.vacacionesService.obtenerMisSolicitudes(usuario.idUsuario);
  }

  // =========================================================
  // EMPLEADO - ANULAR SOLICITUD
  // =========================================================

  @Post(':id/anular')
  @ApiOperation({
    summary: 'Anular una solicitud propia de vacaciones',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la solicitud de vacaciones',
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  anularVacaciones(@Param('id') idPermisoVaca: string, @Req() request: Request) {
    const usuario = this.obtenerUsuario(request);

    return this.vacacionesService.anularVacaciones(idPermisoVaca, usuario.idUsuario);
  }

  // =========================================================
  // JEFE INMEDIATO - SOLICITUDES PENDIENTES
  // =========================================================

  @Get('pendientes-jefe')
  @ApiOperation({
    summary: 'Consultar solicitudes de vacaciones pendientes del Jefe Inmediato',
  })
  obtenerSolicitudesPendientesJefe(@Req() request: Request) {
    const usuario = this.validarJefeVacaciones(request);

    return this.vacacionesService.obtenerSolicitudesPendientesJefe(usuario.idUsuario);
  }

  // =========================================================
  // JEFE INMEDIATO - APROBAR
  // =========================================================

  @Post(':id/aprobar-jefe')
  @ApiOperation({
    summary: 'Aprobar una solicitud de vacaciones como Jefe Inmediato',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la solicitud de vacaciones',
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  aprobarPorJefe(
    @Param('id') idPermisoVaca: string,
    @Req() request: Request,
    @Body() body: AprobarVacacionesDto,
  ) {
    const usuario = this.validarJefeVacaciones(request);

    return this.vacacionesService.aprobarPorJefe(
      idPermisoVaca,
      usuario.idUsuario,
      usuario.email,
      body.observacion,
    );
  }

  // =========================================================
  // ENCARGADO - SOLICITUDES PARA VERIFICAR SALDO
  // =========================================================

  @Get('pendientes-verificacion')
  @ApiOperation({
    summary: 'Consultar solicitudes de vacaciones pendientes de verificación de saldo',
  })
  obtenerSolicitudesPendientesVerificacion(@Req() request: Request) {
    this.validarVerificadorVacaciones(request);

    return this.vacacionesService.obtenerSolicitudesPendientesVerificacion();
  }

  // =========================================================
  // ENCARGADO - VERIFICAR SALDO
  // =========================================================

  @Post(':id/verificar-saldo')
  @ApiOperation({
    summary: 'Verificar el saldo disponible y dar visto bueno a una solicitud',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la solicitud de vacaciones',
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  verificarSaldoYDarVistoBueno(
    @Param('id') idPermisoVaca: string,
    @Req() request: Request,
    @Body() body: AprobarVacacionesDto,
  ) {
    const usuario = this.validarVerificadorVacaciones(request);

    return this.vacacionesService.verificarSaldoYDarVistoBueno(
      idPermisoVaca,
      usuario.idUsuario,
      usuario.email,
      body.observacion,
    );
  }
  // =========================================================
  // AUTORIZACIÓN PARA JEFE INMEDIATO
  // =========================================================

  private validarJefeVacaciones(request: Request): {
    idUsuario: string;
    email: string;
    roles: number[];
  } {
    const usuario = this.obtenerUsuario(request);

    // 2 = Jefe Inmediato
    // 5 = Administrador
    const autorizado = usuario.roles.includes(2) || usuario.roles.includes(5);

    if (!autorizado) {
      throw new UnauthorizedException(
        'No tiene permisos para gestionar solicitudes de vacaciones como Jefe Inmediato',
      );
    }

    return usuario;
  }

  // =========================================================
  // AUTORIZACIÓN PARA APROBACIÓN FINAL
  // =========================================================

  private validarAprobacionFinalVacaciones(request: Request): {
    idUsuario: string;
    email: string;
    roles: number[];
  } {
    const usuario = this.obtenerUsuario(request);

    // 3 = Subgerencia RRHH
    // 5 = Administrador
    const autorizado = usuario.roles.includes(3) || usuario.roles.includes(5);

    if (!autorizado) {
      throw new UnauthorizedException(
        'No tiene permisos para realizar la aprobación final de vacaciones',
      );
    }

    return usuario;
  }

  // =========================================================
  // SUBGERENCIA RRHH - SOLICITUDES PENDIENTES
  // =========================================================

  @Get('pendientes-subgerente')
  @ApiOperation({
    summary: 'Consultar solicitudes de vacaciones pendientes de Subgerencia',
  })
  obtenerSolicitudesPendientesSubgerente() {
    return this.vacacionesService.obtenerSolicitudesPendientesSubgerente();
  }

  // =========================================================
  // SUBGERENCIA RRHH - APROBACIÓN FINAL
  // =========================================================

  @Post(':id/aprobar-subgerente')
  @ApiOperation({
    summary: 'Aprobar definitivamente una solicitud de vacaciones como Subgerencia de RRHH',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la solicitud de vacaciones',
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  aprobarPorSubgerente(
    @Param('id') idPermisoVaca: string,
    @Req() request: Request,
    @Body() body: AprobarVacacionesDto,
  ) {
    const usuario = this.validarAprobacionFinalVacaciones(request);

    return this.vacacionesService.aprobarPorSubgerente(
      idPermisoVaca,
      usuario.idUsuario,
      usuario.email,
      body.observacion,
    );
  }

  // =========================================================
  // RECHAZAR SOLICITUD
  // =========================================================

  @Post(':id/rechazar')
  @ApiOperation({
    summary: 'Rechazar una solicitud de vacaciones',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID de la solicitud de vacaciones',
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  rechazarVacaciones(
    @Param('id') idPermisoVaca: string,
    @Req() request: Request,
    @Body() body: RechazarVacacionesDto,
  ) {
    const usuario = this.obtenerUsuario(request);

    return this.vacacionesService.rechazarVacaciones(
      idPermisoVaca,
      usuario.idUsuario,
      usuario.email,
      body.motivoRechazo,
    );
  }

  // =========================================================
  // REPORTE DE VACACIONES
  // =========================================================

  @Get('reporte')
  @ApiOperation({
    summary: 'Consultar reporte de vacaciones',
  })
  obtenerReporteVacaciones(@Req() request: Request) {
    const usuario = this.obtenerUsuario(request);

    const anioActual = new Date().getFullYear();

    return this.vacacionesService.obtenerReporteVacaciones(
      usuario.idUsuario,
      usuario.roles,
      anioActual,
    );
  }

  // =========================================================
  // CARGA INICIAL DE SALDO
  // =========================================================

  @Post('saldo/carga-inicial')
  @ApiOperation({
    summary: 'Registrar manualmente el saldo inicial de vacaciones de un empleado',
  })
  cargarSaldoInicial(@Req() request: Request, @Body() body: CargaInicialSaldoDto) {
    const usuario = this.validarGestionVacaciones(request);

    return this.vacacionesService.cargarSaldoInicial(usuario.idUsuario, body);
  }

  // =========================================================
  // AJUSTE INDIVIDUAL
  // =========================================================

  @Post('saldo/ajuste')
  @ApiOperation({
    summary: 'Agregar o descontar días del saldo de un empleado. La justificación es obligatoria.',
  })
  ajustarSaldo(@Req() request: Request, @Body() body: AjusteSaldoVacacionesDto) {
    const usuario = this.validarGestionVacaciones(request);

    return this.vacacionesService.ajustarSaldo(usuario.idUsuario, body);
  }

  // =========================================================
  // DESCUENTO MASIVO
  // =========================================================

  @Post('saldo/descuento-masivo')
  @ApiOperation({
    summary: 'Descontar días de vacaciones a varios empleados. La justificación es obligatoria.',
  })
  aplicarDescuentoMasivo(@Req() request: Request, @Body() body: DescuentoMasivoVacacionesDto) {
    const usuario = this.validarGestionVacaciones(request);

    return this.vacacionesService.aplicarDescuentoMasivo(usuario.idUsuario, body);
  }

  // =========================================================
  // HISTORIAL DE SALDO
  // =========================================================

  @Get('saldo/historial/:idUsuario')
  @ApiOperation({
    summary: 'Consultar el historial de movimientos del saldo de vacaciones de un empleado',
  })
  @ApiParam({
    name: 'idUsuario',
    description: 'UUID del empleado',
  })
  obtenerHistorialSaldo(@Req() request: Request, @Param('idUsuario') idUsuario: string) {
    this.validarGestionVacaciones(request);

    return this.vacacionesService.obtenerHistorialSaldo(idUsuario);
  }
}
