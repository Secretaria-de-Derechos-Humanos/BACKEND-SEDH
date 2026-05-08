import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { InsertarPermisoOficialDto } from './dto/insertar-permiso-oficial.dto';
import { PermisosOficialesService } from './permisos-oficiales.service';

@ApiTags('Permisos Oficiales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rrhh/permisos-oficiales')
export class PermisosOficialesController {
  constructor(private readonly permisosOficialesService: PermisosOficialesService) {}

  @Post('insertar')
  @ApiBody({ type: InsertarPermisoOficialDto })
  insertarPermisoOficial(@Body() dto: InsertarPermisoOficialDto) {
    return this.permisosOficialesService.insertarPermisoOficial(dto);
  }
}
