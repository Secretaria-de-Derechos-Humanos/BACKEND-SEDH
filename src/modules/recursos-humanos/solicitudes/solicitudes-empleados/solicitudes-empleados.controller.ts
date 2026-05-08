import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { UsuarioActual } from '../../../../shared/decorators/usuario-actual.decorator';
import { Usuario } from '../../../../core/usuarios/entities/usuario.entity';
import { SolicitudesEmpleadosService } from './solicitudes-empleados.service';

class EmailBodyDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
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

  @Get('mis-solicitudes-emergencia')
  getMisSolicitudesEmergencia(@UsuarioActual() usuario: Usuario) {
    return this.solicitudesEmpleadosService.getMisSolicitudesEmergencia(usuario.emailInstitucional);
  }
}
