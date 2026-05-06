import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogosService } from './catalogos.service';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';

@ApiTags('Catálogos RRHH')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recursos-humanos/catalogos')
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('cargos')
  findCargos() { return this.catalogosService.findCargos(); }

  @Get('dependencias')
  findDependencias() { return this.catalogosService.findDependencias(); }

  @Get('departamentos')
  findDepartamentos() { return this.catalogosService.findDepartamentos(); }

  @Get('municipios')
  findMunicipios() { return this.catalogosService.findMunicipios(); }

  @Get('sexos')
  findSexos() { return this.catalogosService.findSexos(); }

  @Get('estados-civiles')
  findEstadosCiviles() { return this.catalogosService.findEstadosCiviles(); }

  @Get('tipos-contrataciones')
  findTiposContrataciones() { return this.catalogosService.findTiposContrataciones(); }

  @Get('estados-solicitudes')
  findEstadosSolicitudes() { return this.catalogosService.findEstadosSolicitudes(); }

  @Get('tipos-solicitudes-empleados')
  findTiposSolicitudesEmpleados() { return this.catalogosService.findTiposSolicitudesEmpleados(); }
}
