import {
  Body,
  Controller,
  Get,
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

type RequestAutenticado = Request & {
  user?: JwtPayload;
};

@ApiTags('Permisos Personales')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rrhh/permisos-personales')
export class PermisosPersonalesController {
  constructor(private readonly permisosPersonalesService: PermisosPersonalesService) {}

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
}
