import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../shared/guards/permisos.guard';
import { RequierePermiso } from '../../shared/decorators/requiere-permiso.decorator';

@ApiTags('Usuarios')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get()
  @RequierePermiso('Ver usuarios')
  listar() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequierePermiso('Ver usuarios')
  obtener(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequierePermiso('Crear usuario')
  crear(@Body() dto: CrearUsuarioDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  @RequierePermiso('Editar usuario')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarUsuarioDto) {
    return this.service.actualizar(id, dto);
  }
}
