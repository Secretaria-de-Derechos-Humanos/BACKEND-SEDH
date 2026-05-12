import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../shared/guards/permisos.guard';
import { RequiereModulo } from '../../../shared/decorators/requiere-permiso.decorator';
import { EmpleadosService } from './empleados.service';
import { BuscarEmpleadoAdminDto } from './dto/buscar-empleado-admin.dto';
import { ActualizarEmpleadoAdminDto } from './dto/actualizar-empleado-admin.dto';
import { CrearEmpleadoAdminDto } from './dto/crear-empleado-admin.dto';

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

  @Post('datos-sedh')
  @ApiOperation({ summary: 'Obtener catálogos SEDH previo a actualizar un empleado' })
  @RequiereModulo(1)
  obtenerDatosSedh() {
    return this.empleadosService.obtenerDatosSedh();
  }

  @Post('actualizar')
  @ApiOperation({ summary: 'Actualizar datos de un empleado (administrador RRHH)' })
  @ApiBody({ type: ActualizarEmpleadoAdminDto })
  @RequiereModulo(1)
  actualizarEmpleadoAdmin(@Body() dto: ActualizarEmpleadoAdminDto) {
    return this.empleadosService.actualizarEmpleadoAdmin(
      dto.emailEmpleado,
      dto.email,
      dto.rol,
      dto.idmodulo,
      { empleado: dto.empleado, accesosSistema: dto.accesosSistema },
    );
  }

  @Post('crear')
  @ApiOperation({ summary: 'Crear un nuevo empleado (administrador RRHH)' })
  @ApiBody({ type: CrearEmpleadoAdminDto })
  @RequiereModulo(1)
  crearEmpleadoAdmin(@Body() dto: CrearEmpleadoAdminDto) {
    return this.empleadosService.crearEmpleadoAdmin(dto.email, dto.rol, dto.idmodulo, {
      contrasena: dto.contrasena,
      empleado: dto.empleado,
      accesosSistema: dto.accesosSistema,
    });
  }
}
