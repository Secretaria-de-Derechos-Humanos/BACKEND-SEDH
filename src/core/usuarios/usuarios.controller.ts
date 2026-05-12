import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../shared/guards/permisos.guard';
import { RequiereModulo } from '../../shared/decorators/requiere-permiso.decorator';
import { UsuariosService } from './usuarios.service';

class HeatmapActividadesDto {
  @ApiProperty({ example: 'luis.cardona@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('core/usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post('heatmap-actividades')
  @ApiOperation({ summary: 'Obtener actividad diaria del usuario (heatmap)' })
  @RequiereModulo(1)
  heatmapActividades(@Body() body: HeatmapActividadesDto) {
    return this.usuariosService.obtenerHeatmapActividades(body.email);
  }
}
