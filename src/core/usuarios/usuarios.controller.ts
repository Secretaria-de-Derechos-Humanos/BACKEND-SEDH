import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  HttpCode,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../shared/guards/permisos.guard';
import { RequiereModulo } from '../../shared/decorators/requiere-permiso.decorator';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { BackendAdminGuard } from '../../core/auth/guards/backend-admin.guard';
import { RestablecerPasswordDto } from '../../core/usuarios/dto/restablecer-password.dto';
import { CambiarPasswordDto } from '../../core/usuarios/dto/cambiar-password.dto';
import { Req } from '@nestjs/common';
import { Request } from 'express';

class HeatmapActividadesDto {
  @ApiProperty({ example: 'luis.cardona@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

@ApiTags('Usuarios')
@ApiBearerAuth('acces-token')
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
  @Post('crear')
  @ApiOperation({ summary: 'Registrar un nuevo usuario en el sistema' })
  async crearUsuario(@Body() body: CrearUsuarioDto) {
    return this.usuariosService.crear(body);
  }
  @Get('listar')
  @UseGuards(JwtAuthGuard, BackendAdminGuard)
  async listarUsuarios() {
    return this.usuariosService.findAllWithRoles();
  }
  @Get(':idUsuario/resumen')
  @ApiOperation({
    summary: 'Consultar información básica de un usuario',
  })
  obtenerResumenUsuario(@Param('idUsuario') idUsuario: string) {
    return this.usuariosService.obtenerResumenUsuario(idUsuario);
  }

  @Patch('actualizar/:idUsuario')
  @ApiOperation({ summary: 'Modificar contraseña, rol o estado de un usuario' })
  async actualizarUsuario(
    @Param('idUsuario') idUsuario: string,
    @Body() body: ActualizarUsuarioDto,
  ) {
    return this.usuariosService.actualizar(idUsuario, body);
  }
  @Post(':idUsuario/reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restablecer la contraseña de un usuario' })
  async resetPassword(@Param('idUsuario') idUsuario: string) {
    return this.usuariosService.resetPassword(idUsuario);
  }
  @Patch(':idUsuario/password')
  @ApiOperation({
    summary: 'Asignar contraseña temporal a un usuario',
  })
  asignarPasswordTemporal(
    @Param('idUsuario') idUsuario: string,
    @Body() body: RestablecerPasswordDto,
  ) {
    return this.usuariosService.asignarPasswordTemporal(idUsuario, body.nuevaPassword);
  }
  @Patch('cambiar-password')
  @ApiOperation({
    summary: 'Cambiar la contraseña del usuario autenticado',
  })
  async cambiarPassword(@Req() request: Request, @Body() body: CambiarPasswordDto) {
    const usuarioAutenticado = request.user as {
      idUsuario?: string;
      id?: string;
      sub?: string;
      email?: string;
    };
    const idUsuario =
      usuarioAutenticado.idUsuario ?? usuarioAutenticado.id ?? usuarioAutenticado.sub;
    if (!idUsuario) {
      throw new UnauthorizedException(
        'No se pudo obtener el identificador del usuario autenticado',
      );
    }
    return this.usuariosService.cambiarPassword(idUsuario, body.passwordActual, body.nuevaPassword);
  }
}
