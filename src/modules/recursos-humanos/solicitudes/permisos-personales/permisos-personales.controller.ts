import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { InsertarPermisoPersonalDto } from './dto/insertar-permiso-personal.dto';
import { PermisosPersonalesService } from './permisos-personales.service';

@ApiTags('Permisos Personales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rrhh/permisos-personales')
export class PermisosPersonalesController {
  constructor(private readonly permisosPersonalesService: PermisosPersonalesService) {}

  @Post('insertar')
  @ApiBody({ type: InsertarPermisoPersonalDto })
  insertarPermisoPersonal(@Body() dto: InsertarPermisoPersonalDto) {
    return this.permisosPersonalesService.insertarPermisoPersonal(dto);
  }
}
