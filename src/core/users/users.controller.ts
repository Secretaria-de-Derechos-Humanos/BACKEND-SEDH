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
import { UsersService } from './users.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';

@ApiTags('Empleados')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('employees')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions({ module: 'core', subModule: 'employees', action: 'create' })
  @ApiOperation({ summary: 'Crear empleado' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @RequirePermissions({ module: 'core', subModule: 'employees', action: 'read' })
  @ApiOperation({ summary: 'Listar empleados' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermissions({ module: 'core', subModule: 'employees', action: 'read' })
  @ApiOperation({ summary: 'Obtener empleado por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOneById(id);
  }

  @Patch(':id')
  @RequirePermissions({ module: 'core', subModule: 'employees', action: 'update' })
  @ApiOperation({ summary: 'Actualizar empleado' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ module: 'core', subModule: 'employees', action: 'delete' })
  @ApiOperation({ summary: 'Eliminar empleado (soft delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
