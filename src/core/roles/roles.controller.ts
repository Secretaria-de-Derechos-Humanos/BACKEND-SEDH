import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermissions({ module: 'core', subModule: 'roles', action: 'create' })
  @ApiOperation({ summary: 'Crear rol' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @RequirePermissions({ module: 'core', subModule: 'roles', action: 'read' })
  @ApiOperation({ summary: 'Listar roles' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @RequirePermissions({ module: 'core', subModule: 'roles', action: 'read' })
  @ApiOperation({ summary: 'Obtener rol por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOneById(id);
  }

  @Patch(':id')
  @RequirePermissions({ module: 'core', subModule: 'roles', action: 'update' })
  @ApiOperation({ summary: 'Actualizar rol' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ module: 'core', subModule: 'roles', action: 'delete' })
  @ApiOperation({ summary: 'Eliminar rol (soft delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }
}
