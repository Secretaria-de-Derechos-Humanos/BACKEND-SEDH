import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogosService } from './catalogos.service';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { RequiereRol } from '../../../shared/decorators/requiere-rol.decorator';
import { CrearCargoDto } from './dto/crear-cargo.dto';
import { ActualizarCargoDto } from './dto/actualizar-cargo.dto';

@ApiTags('Catálogos RRHH')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recursos-humanos/catalogos')
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  // ============================================================
  // DEPENDENCIAS
  // ============================================================

  @Get('dependencias')
  @ApiOperation({
    summary: 'Consultar dependencias',
  })
  findDependencias() {
    return this.catalogosService.findDependencias();
  }

  // ============================================================
  // CARGOS
  // ============================================================

  @Get('cargos')
  @ApiOperation({
    summary: 'Consultar cargos',
  })
  findCargos() {
    return this.catalogosService.findCargos();
  }

  @Get('cargos/dependencia/:idDependencia')
  @ApiOperation({
    summary: 'Consultar cargos de una dependencia',
  })
  findCargosPorDependencia(
    @Param('idDependencia', ParseIntPipe)
    idDependencia: number,
  ) {
    return this.catalogosService.findCargosPorDependencia(idDependencia);
  }

  // ============================================================
  // CREAR CARGO
  // SOLO ROL 3 Y ROL 5
  //
  // 3 = SUBGERENTE RRHH
  // 5 = ADMIN RRHH
  // ============================================================

  @Post('cargos')
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Crear un cargo dentro de una dependencia',
  })
  crearCargo(@Body() body: CrearCargoDto) {
    return this.catalogosService.crearCargo(body);
  }

  // ============================================================
  // ACTUALIZAR CARGO
  // SOLO ROL 3 Y ROL 5
  // ============================================================

  @Patch('cargos/:idCargo')
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Actualizar un cargo',
  })
  actualizarCargo(
    @Param('idCargo', ParseIntPipe)
    idCargo: number,

    @Body() body: ActualizarCargoDto,
  ) {
    return this.catalogosService.actualizarCargo(idCargo, body);
  }

  // ============================================================
  // ELIMINAR CARGO
  // SOLO ROL 3 Y ROL 5
  // ============================================================

  @Delete('cargos/:idCargo')
  @RequiereRol(3, 5)
  @ApiOperation({
    summary: 'Eliminar un cargo',
  })
  eliminarCargo(
    @Param('idCargo', ParseIntPipe)
    idCargo: number,
  ) {
    return this.catalogosService.eliminarCargo(idCargo);
  }

  // ============================================================
  // OTROS CATÁLOGOS
  // ============================================================

  @Get('departamentos')
  @ApiOperation({
    summary: 'Consultar departamentos',
  })
  findDepartamentos() {
    return this.catalogosService.findDepartamentos();
  }

  @Get('municipios')
  @ApiOperation({
    summary: 'Consultar municipios',
  })
  findMunicipios() {
    return this.catalogosService.findMunicipios();
  }

  @Get('sexos')
  @ApiOperation({
    summary: 'Consultar sexos',
  })
  findSexos() {
    return this.catalogosService.findSexos();
  }

  @Get('estados-civiles')
  @ApiOperation({
    summary: 'Consultar estados civiles',
  })
  findEstadosCiviles() {
    return this.catalogosService.findEstadosCiviles();
  }

  @Get('tipos-contrataciones')
  @ApiOperation({
    summary: 'Consultar tipos de contratación',
  })
  findTiposContrataciones() {
    return this.catalogosService.findTiposContrataciones();
  }

  @Get('estados-solicitudes')
  @ApiOperation({
    summary: 'Consultar estados de solicitudes',
  })
  findEstadosSolicitudes() {
    return this.catalogosService.findEstadosSolicitudes();
  }

  @Get('tipos-solicitudes-empleados')
  @ApiOperation({
    summary: 'Consultar tipos de solicitudes de empleados',
  })
  findTiposSolicitudesEmpleados() {
    return this.catalogosService.findTiposSolicitudesEmpleados();
  }
}
