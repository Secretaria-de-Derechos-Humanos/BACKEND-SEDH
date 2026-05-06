import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';

@ApiTags('Permisos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @RequirePermissions({ module: 'core', subModule: 'permissions', action: 'create' })
  @ApiOperation({ summary: 'Crear permiso' })
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Get()
  @RequirePermissions({ module: 'core', subModule: 'permissions', action: 'read' })
  @ApiOperation({ summary: 'Listar permisos' })
  @ApiQuery({ name: 'module', required: false })
  findAll(@Query('module') module?: string) {
    if (module) return this.permissionsService.findByModule(module);
    return this.permissionsService.findAll();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ module: 'core', subModule: 'permissions', action: 'delete' })
  @ApiOperation({ summary: 'Eliminar permiso' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.remove(id);
  }
}
