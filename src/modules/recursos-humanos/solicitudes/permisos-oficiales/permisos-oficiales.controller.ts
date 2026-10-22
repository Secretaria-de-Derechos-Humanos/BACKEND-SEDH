import {
  Get,
  Query,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';

import { Request } from 'express';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../../../core/auth/strategies/jwt.strategy';
import { InsertarPermisoOficialDto } from './dto/insertar-permiso-oficial.dto';
import { RegistrarPermisoOficialManualDto } from './dto/registrar-permiso-oficial-manual.dto';
import { PermisosOficialesService } from './permisos-oficiales.service';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { RequiereRol } from '../../../../shared/decorators/requiere-rol.decorator';

type RequestAutenticado = Request & {
  user?: JwtPayload;
};

@ApiTags('Permisos Oficiales')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rrhh/permisos-oficiales')
export class PermisosOficialesController {
  constructor(private readonly permisosOficialesService: PermisosOficialesService) {}

  @Post('insertar')
  @ApiOperation({
    summary: 'Registrar un permiso oficial para el usuario autenticado',
  })
  insertarPermisoOficial(
    @Req() request: RequestAutenticado,
    @Body() dto: InsertarPermisoOficialDto,
  ) {
    const email = request.user?.email?.trim();

    if (!email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosOficialesService.insertarPermisoOficial(dto, email);
  }

  @Post('registrar-manual')
  @UseGuards(RolesGuard)
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Registrar un permiso oficial que ya fue aprobado en papel',
  })
  registrarPermisoOficialManual(
    @Req() request: RequestAutenticado,
    @Body() dto: RegistrarPermisoOficialManualDto,
  ) {
    const emailResponsable = request.user?.email?.trim();
    if (!emailResponsable) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosOficialesService.registrarPermisoOficialManual(dto, emailResponsable);
  }

  @Post('anular/:id')
  @ApiOperation({
    summary: 'Anular un permiso oficial del usuario autenticado',
  })
  anularPermisoOficial(@Req() request: RequestAutenticado, @Param('id') idPermiso: string) {
    const email = request.user?.email?.trim();

    if (!email) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado');
    }

    return this.permisosOficialesService.anularPermisoOficial(idPermiso, email);
  }

  @Get('reporte-manual')
  @UseGuards(RolesGuard)
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Consultar permisos oficiales manuales por rango de fechas',
  })
  @ApiQuery({ name: 'fechaInicio', required: true, example: '2026-10-01' })
  @ApiQuery({ name: 'fechaFinal', required: true, example: '2026-10-20' })
  consultarReporteManual(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFinal') fechaFinal: string,
  ) {
    return this.permisosOficialesService.consultarReporteManual(fechaInicio, fechaFinal);
  }
}
