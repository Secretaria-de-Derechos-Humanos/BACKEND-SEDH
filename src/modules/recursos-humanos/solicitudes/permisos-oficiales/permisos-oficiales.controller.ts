import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Permisos Oficiales')
@Controller('recursos-humanos/permisos-oficiales')
export class PermisosOficialesController {}
