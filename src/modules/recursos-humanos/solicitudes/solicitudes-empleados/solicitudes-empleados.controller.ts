import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { SolicitudesEmpleadosService } from './solicitudes-empleados.service';

class EmailBodyDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

@ApiTags('Solicitudes Empleados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rrhh/solicitudes-empleados')
export class SolicitudesEmpleadosController {
  constructor(private readonly solicitudesEmpleadosService: SolicitudesEmpleadosService) {}

  @Post('mis-solicitudes')
  @ApiBody({ type: EmailBodyDto })
  getSolicitudesEmpleadoRRHH(@Body() body: EmailBodyDto) {
    return this.solicitudesEmpleadosService.getSolicitudesEmpleadoRRHH(body.email);
  }

  @Post('mis-solicitudes-emergencia')
  @ApiBody({ type: EmailBodyDto })
  getMisSolicitudesEmergencia(@Body() body: EmailBodyDto) {
    return this.solicitudesEmpleadosService.getMisSolicitudesEmergencia(body.email);
  }

  @Post('datos-permiso')
  @ApiBody({ type: EmailBodyDto })
  cargarDatosAgregarPermisos(@Body() body: EmailBodyDto) {
    return this.solicitudesEmpleadosService.cargarDatosAgregarPermisos(body.email);
  }
}
