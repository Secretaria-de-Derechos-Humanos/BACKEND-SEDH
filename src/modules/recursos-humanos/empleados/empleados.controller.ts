import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../shared/guards/permisos.guard';
import { RequiereModulo } from '../../../shared/decorators/requiere-permiso.decorator';
import { EmpleadosService } from './empleados.service';
import { BuscarEmpleadoAdminDto } from './dto/buscar-empleado-admin.dto';
import { ActualizarEmpleadoAdminDto } from './dto/actualizar-empleado-admin.dto';
import { CrearEmpleadoAdminDto } from './dto/crear-empleado-admin.dto';
import { ActualizarHorasDisponiblesDto } from './dto/actualizar-horas-disponibles.dto';
import { VincularUsuarioEmpleadoDto } from './dto/vincular-usuario-empleado.dto';

interface UsuarioJwt {
  email: string;
  roles?: Array<{
    r: number;
    m: number[];
  }>;
}

interface RequestAutenticada {
  user: UsuarioJwt;
}

@ApiTags('Empleados')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('rrhh/empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Post('buscar')
  @ApiOperation({
    summary: 'Buscar un empleado por email (administrador RRHH)',
  })
  @ApiBody({ type: BuscarEmpleadoAdminDto })
  @RequiereModulo(1)
  buscarEmpleadoAdmin(@Body() dto: BuscarEmpleadoAdminDto, @Req() req: RequestAutenticada) {
    const usuario = req.user;

    const accesoModulo = usuario.roles?.find(
      (acceso) => Array.isArray(acceso.m) && acceso.m.some((idModulo) => Number(idModulo) === 1),
    );

    if (!accesoModulo) {
      throw new BadRequestException('El usuario autenticado no tiene acceso al módulo de RRHH');
    }

    return this.empleadosService.buscarEmpleadoAdmin(
      dto.emailEmpleado,
      usuario.email,
      Number(accesoModulo.r),
      1,
    );
  }

  @Post('datos-sedh')
  @ApiOperation({
    summary: 'Obtener catálogos SEDH previo a actualizar un empleado',
  })
  @RequiereModulo(1)
  obtenerDatosSedh() {
    return this.empleadosService.obtenerDatosSedh();
  }

  @Post('actualizar')
  @ApiOperation({
    summary: 'Actualizar datos de un empleado (administrador RRHH)',
  })
  @ApiBody({ type: ActualizarEmpleadoAdminDto })
  @RequiereModulo(1)
  actualizarEmpleadoAdmin(@Body() dto: ActualizarEmpleadoAdminDto, @Req() req: RequestAutenticada) {
    const usuario = req.user;

    if (!usuario?.email) {
      throw new BadRequestException('No se pudo identificar al usuario autenticado');
    }

    const accesoModulo = usuario.roles?.find(
      (acceso) => Array.isArray(acceso.m) && acceso.m.some((idModulo) => Number(idModulo) === 1),
    );

    if (!accesoModulo) {
      throw new BadRequestException('El usuario autenticado no tiene acceso al módulo de RRHH');
    }

    return this.empleadosService.actualizarEmpleadoAdmin(
      dto.emailEmpleado,
      usuario.email,
      Number(accesoModulo.r),
      1,
      {
        empleado: dto.empleado,
        accesosSistema: dto.accesosSistema,
      },
    );
  }

  @Post('crear')
  @ApiOperation({
    summary: 'Crear un nuevo empleado (administrador RRHH)',
  })
  @ApiBody({ type: CrearEmpleadoAdminDto })
  @RequiereModulo(1)
  crearEmpleadoAdmin(@Body() dto: CrearEmpleadoAdminDto) {
    return this.empleadosService.crearEmpleadoAdmin(dto.email, dto.rol, dto.idmodulo, {
      contrasena: dto.contrasena,
      empleado: dto.empleado,
      accesosSistema: dto.accesosSistema,
    });
  }

  @Post('actualizar-horas-disponibles')
  @ApiOperation({
    summary: 'Actualizar horas disponibles de un empleado (administrador RRHH)',
  })
  @ApiBody({ type: ActualizarHorasDisponiblesDto })
  @RequiereModulo(1)
  actualizarHorasDisponibles(@Body() dto: ActualizarHorasDisponiblesDto) {
    return this.empleadosService.actualizarHorasDisponibles(
      dto.emailEmpleado,
      dto.horasDisponibles,
      dto.email,
      dto.rol,
      dto.idmodulo,
    );
  }

  @Post('vincular-usuario')
  @ApiOperation({
    summary: 'Vincular un usuario existente con un empleado',
  })
  @ApiBody({ type: VincularUsuarioEmpleadoDto })
  @RequiereModulo(1)
  vincularUsuarioEmpleado(@Body() dto: VincularUsuarioEmpleadoDto, @Req() req: RequestAutenticada) {
    const emailAdmin = req.user?.email;

    if (!emailAdmin) {
      throw new BadRequestException('No se pudo identificar al administrador');
    }

    return this.empleadosService.vincularUsuarioEmpleado(dto.idUsuario, dto.empleado, emailAdmin);
  }

  @Get('listar')
  @ApiOperation({ summary: 'Listar empleados registrados' })
  @RequiereModulo(1)
  listarEmpleados(@Query('buscar') buscar?: string) {
    return this.empleadosService.listarEmpleados(buscar);
  }
}
