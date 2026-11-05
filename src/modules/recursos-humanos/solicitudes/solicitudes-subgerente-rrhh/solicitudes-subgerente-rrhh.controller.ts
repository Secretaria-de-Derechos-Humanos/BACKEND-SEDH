import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBody, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../../../core/auth/strategies/jwt.strategy';
import { SolicitudesSubgerenteRrhhService } from './solicitudes-subgerente-rrhh.service';
import { CargarPendientesSubgerenteDto } from './dto/cargar-pendientes-subgerente.dto';
import { ResponderSolicitudSubgerenteDto } from './dto/responder-solicitud-subgerente.dto';

type RequestWithUser = {
  user: JwtPayload;
};

@ApiTags('Solicitudes Subgerente RRHH')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rrhh/subgerente')
export class SolicitudesSubgerenteRrhhController {
  constructor(
    private readonly solicitudesSubgerenteRrhhService: SolicitudesSubgerenteRrhhService,
  ) {}

  private validarAccesoModulo(user: JwtPayload, rol: number, modulo: number): void {
    if (!user?.email) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado');
    }

    const autorizado = user.roles?.some(
      (item) =>
        Number(item.r) === Number(rol) &&
        item.m?.some((idModulo) => Number(idModulo) === Number(modulo)),
    );

    if (!autorizado) {
      throw new ForbiddenException('El usuario no tiene autorización para este rol y módulo');
    }
  }

  @Post('pendientes')
  @ApiOperation({ summary: 'Cargar solicitudes pendientes por aprobar de la subgerente RRHH' })
  @ApiBody({ type: CargarPendientesSubgerenteDto })
  cargarPendientes(@Body() body: CargarPendientesSubgerenteDto, @Req() req: RequestWithUser) {
    const user = req.user;
    const rol = Number(body.rol);
    const modulo = Number(body.modulo ?? body.idmodulo);

    if (!Number.isInteger(rol) || !Number.isInteger(modulo) || modulo <= 0) {
      throw new BadRequestException('El rol y el módulo son obligatorios y deben ser válidos');
    }

    this.validarAccesoModulo(user, rol, modulo);

    return this.solicitudesSubgerenteRrhhService.cargarPendientes(user.email, rol, modulo);
  }

  @Post('responder')
  @ApiOperation({ summary: 'Aprobar o rechazar una solicitud como subgerente RRHH' })
  @ApiBody({ type: ResponderSolicitudSubgerenteDto })
  responderSolicitud(@Body() body: ResponderSolicitudSubgerenteDto, @Req() req: RequestWithUser) {
    const user = req.user;
    const rol = Number(body.rol);
    const modulo = Number(body.modulo ?? body.idmodulo);

    if (!Number.isInteger(rol) || !Number.isInteger(modulo) || modulo <= 0) {
      throw new BadRequestException('El rol y el módulo son obligatorios y deben ser válidos');
    }

    this.validarAccesoModulo(user, rol, modulo);

    return this.solicitudesSubgerenteRrhhService.responderSolicitud({
      ...body,
      email: user.email,
      rol,
      modulo,
    });
  }
}
