import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../shared/guards/permisos.guard';
import { RequiereModulo } from '../../../shared/decorators/requiere-permiso.decorator';
import { EmpleadosService } from './empleados.service';
import { BuscarEmpleadoAdminDto } from './dto/buscar-empleado-admin.dto';

@ApiTags('Empleados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('rrhh/empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Post('buscar')
  @ApiOperation({ summary: 'Buscar un empleado por email (administrador RRHH)' })
  @ApiBody({ type: BuscarEmpleadoAdminDto })
  @RequiereModulo(1)
  buscarEmpleadoAdmin(@Body() dto: BuscarEmpleadoAdminDto) {
    return this.empleadosService.buscarEmpleadoAdmin(
      dto.emailEmpleado,
      dto.email,
      dto.rol,
      dto.idmodulo,
    );
  }
}

