import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../../../core/auth/strategies/jwt.strategy';
import { InsertarPermisoOficialDto } from './dto/insertar-permiso-oficial.dto';
import { PermisosOficialesService } from './permisos-oficiales.service';

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
}
