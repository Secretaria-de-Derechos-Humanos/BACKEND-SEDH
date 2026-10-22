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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../../../core/auth/strategies/jwt.strategy';
import { InsertarPermisoPersonalDto } from './dto/insertar-permiso-personal.dto';
import { PermisosPersonalesService } from './permisos-personales.service';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { RequiereRol } from '../../../../shared/decorators/requiere-rol.decorator';
import { RegistrarPermisoManualDto } from './dto/registrar-permiso-manual.dto';
import { RegistrarJustificacionLlegadaTardiaDto } from './dto/registrar-justificacion-llegada-tardia.dto';

type RequestAutenticado = Request & {
  user?: JwtPayload;
};

@ApiTags('Permisos Personales')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rrhh/permisos-personales')
export class PermisosPersonalesController {
  constructor(private readonly permisosPersonalesService: PermisosPersonalesService) {}

  // ============================================================
  // DATOS DEL EMPLEADO AUTENTICADO
  // ============================================================

  @Post('datos')
  @ApiOperation({
    summary: 'Consultar los datos del empleado autenticado para una solicitud',
  })
  obtenerDatosPermiso(@Req() request: RequestAutenticado) {
    const email = request.user?.email?.trim();

    if (!email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosPersonalesService.obtenerDatosPermiso(email);
  }

  // ============================================================
  // INSERTAR PERMISO PERSONAL
  // ============================================================

  @Post('insertar')
  @ApiOperation({
    summary: 'Registrar un permiso personal para el usuario autenticado',
  })
  insertarPermisoPersonal(
    @Req() request: RequestAutenticado,
    @Body() dto: InsertarPermisoPersonalDto,
  ) {
    const email = request.user?.email?.trim();

    if (!email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosPersonalesService.insertarPermisoPersonal(dto, email);
  }

  // ============================================================
  // ANULAR PERMISO PERSONAL
  // ============================================================

  @Post('anular/:id')
  @ApiOperation({
    summary: 'Anular un permiso personal del usuario autenticado',
  })
  anularPermisoPersonal(@Req() request: RequestAutenticado, @Param('id') idPermiso: string) {
    const email = request.user?.email?.trim();

    if (!email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosPersonalesService.anularPermisoPersonal(idPermiso, email);
  }

  // ============================================================
  // CONSULTAR DISPONIBILIDAD
  // ============================================================

  @Get('disponibilidad')
  @ApiOperation({
    summary: 'Consultar horas disponibles del usuario autenticado',
  })
  @ApiQuery({
    name: 'fecha',
    required: true,
    example: '2026-08-05',
  })
  consultarDisponibilidad(@Req() request: RequestAutenticado, @Query('fecha') fecha: string) {
    const email = request.user?.email?.trim();

    if (!email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosPersonalesService.consultarDisponibilidad(email, fecha);
  }
  @Post('registrar-manual')
  @UseGuards(RolesGuard)
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Registrar manualmente un permiso personal recibido en papel',
  })
  registrarPermisoManual(
    @Req() request: RequestAutenticado,
    @Body() dto: RegistrarPermisoManualDto,
  ) {
    const emailResponsable = request.user?.email?.trim();

    if (!emailResponsable) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosPersonalesService.registrarPermisoManual(dto, emailResponsable);
  }

  @Get('reporte-manual')
  @UseGuards(RolesGuard)
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Consultar permisos personales manuales por rango de fechas',
  })
  @ApiQuery({ name: 'fechaInicio', required: true, example: '2026-10-01' })
  @ApiQuery({ name: 'fechaFinal', required: true, example: '2026-10-20' })
  consultarReporteManual(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFinal') fechaFinal: string,
  ) {
    return this.permisosPersonalesService.consultarReporteManual(fechaInicio, fechaFinal);
  }
  @Get('buscar-empleados-activos')
  @UseGuards(RolesGuard)
  @RequiereRol(3, 5)
  @ApiOperation({ summary: 'Buscar empleados activos para permisos manuales' })
  @ApiQuery({ name: 'buscar', required: true, example: 'maria' })
  buscarEmpleadosActivos(@Query('buscar') buscar: string) {
    return this.permisosPersonalesService.buscarEmpleadosActivos(buscar);
  }
  @Get('disponibilidad-manual')
  @UseGuards(RolesGuard)
  @RequiereRol(3, 5)
  @ApiQuery({ name: 'emailEmpleado', required: true, example: 'empleado@sedh.gob.hn' })
  @ApiQuery({ name: 'fecha', required: true, example: '2026-10-21' })
  consultarDisponibilidadManual(
    @Query('emailEmpleado') emailEmpleado: string,
    @Query('fecha') fecha: string,
  ) {
    return this.permisosPersonalesService.consultarDisponibilidadManual(emailEmpleado, fecha);
  }

  // ============================================================
  // LLEGADAS TARDÍAS: REGISTRO MANUAL
  // ============================================================

  @Post('llegada-tardia')
  @UseGuards(RolesGuard)
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Registrar y aprobar una justificación de llegada tardía',
  })
  registrarJustificacionLlegadaTardia(
    @Req() request: RequestAutenticado,
    @Body() dto: RegistrarJustificacionLlegadaTardiaDto,
  ) {
    const emailResponsable = request.user?.email?.trim();

    if (!emailResponsable) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosPersonalesService.registrarJustificacionLlegadaTardia(
      dto,
      emailResponsable,
    );
  }

  // ============================================================
  // LLEGADAS TARDÍAS: HISTORIAL INDEPENDIENTE
  // ============================================================

  @Get('llegadas-tardias')
  @UseGuards(RolesGuard)
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Consultar el historial de justificaciones de llegadas tardías',
  })
  @ApiQuery({
    name: 'fechaInicio',
    required: true,
    example: '2026-10-01',
  })
  @ApiQuery({
    name: 'fechaFinal',
    required: true,
    example: '2026-10-22',
  })
  consultarReporteLlegadasTardias(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFinal') fechaFinal: string,
  ) {
    return this.permisosPersonalesService.consultarReporteLlegadasTardias(fechaInicio, fechaFinal);
  }

  // ============================================================
  // LLEGADAS TARDÍAS: ANULAR Y RESTAURAR SALDO
  // ============================================================

  @Post('llegada-tardia/anular/:id')
  @UseGuards(RolesGuard)
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Anular una justificación y devolver los minutos descontados',
  })
  anularJustificacionLlegadaTardia(
    @Req() request: RequestAutenticado,
    @Param('id') idJustificacion: string,
  ) {
    const emailResponsable = request.user?.email?.trim();

    if (!emailResponsable) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosPersonalesService.anularJustificacionLlegadaTardia(
      idJustificacion,
      emailResponsable,
    );
  }
}
