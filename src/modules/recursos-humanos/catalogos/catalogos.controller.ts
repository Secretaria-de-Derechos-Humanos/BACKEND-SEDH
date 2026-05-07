import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Catálogos RRHH')
@Controller('recursos-humanos/catalogos')
export class CatalogosController {}
