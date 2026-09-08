import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { AprobacionesService } from './aprobaciones.service';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { RequiereRol } from '../../../shared/decorators/requiere-rol.decorator';
import { AprobacionesGuard } from '../../../core/auth/guards/aprobaciones.guard';

class RechazarSolicitudDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  motivoRechazo!: string;
}

@ApiTags('Aprobaciones')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, AprobacionesGuard, RolesGuard)
@RequiereRol(2, 3, 5)
@Controller('rrhh/aprobaciones')
export class AprobacionesController {
  constructor(private readonly aprobacionesService: AprobacionesService) {}

  @Get('oficiales')
  @ApiOperation({
    summary: 'Listar permisos oficiales',
  })
  listarPermisosOficiales() {
    return this.aprobacionesService.listarPermisosOficiales();
  }
  @Get('pendientes')
  @ApiOperation({
    summary: 'Listar permisos personales pendientes de aprobación',
  })
  listarPendientes() {
    return this.aprobacionesService.listarPendientes();
  }
  @Get('historial')
  @ApiOperation({
    summary: 'Listar permisos personales aprobados y rechazados',
  })
  listarHistorial() {
    return this.aprobacionesService.listarHistorial();
  }

  @Patch('personal/:id/aprobar')
  @ApiOperation({
    summary: 'Aprobar un permiso personal',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del permiso personal',
  })
  aprobarPermisoPersonal(@Param('id') id: string, @Req() req: any) {
    const emailAprobador = this.obtenerEmailUsuario(req);

    return this.aprobacionesService.aprobarPermisoPersonal(id, emailAprobador);
  }
  @Patch('personal/:id/rechazar')
  @ApiOperation({
    summary: 'Rechazar un permiso personal',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del permiso personal',
  })
  @ApiBody({
    type: RechazarSolicitudDto,
  })
  rechazarPermisoPersonal(
    @Param('id') id: string,
    @Body() dto: RechazarSolicitudDto,
    @Req() req: any,
  ) {
    const emailAprobador = this.obtenerEmailUsuario(req);
    return this.aprobacionesService.rechazarPermisoPersonal(id, emailAprobador, dto.motivoRechazo);
  }
  @Patch('oficial/:id/aprobar')
  @ApiOperation({
    summary: 'Aprobar un permiso oficial',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del permiso oficial',
  })
  aprobarPermisoOficial(@Param('id') id: string, @Req() req: any) {
    const emailAprobador = this.obtenerEmailUsuario(req);

    return this.aprobacionesService.aprobarPermisoOficial(id, emailAprobador);
  }

  @Patch('oficial/:id/rechazar')
  @ApiOperation({
    summary: 'Rechazar un permiso oficial',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID del permiso oficial',
  })
  @ApiBody({
    type: RechazarSolicitudDto,
  })
  rechazarPermisoOficial(
    @Param('id') id: string,
    @Body() dto: RechazarSolicitudDto,
    @Req() req: any,
  ) {
    const emailAprobador = this.obtenerEmailUsuario(req);

    return this.aprobacionesService.rechazarPermisoOficial(id, emailAprobador, dto.motivoRechazo);
  }
  private obtenerEmailUsuario(req: any): string {
    const email = req.user?.email ?? req.user?.emailInstitucional ?? req.user?.username;
    if (!email) {
      throw new Error('No se pudo obtener el correo del usuario autenticado');
    }

    return email;
  }
}
