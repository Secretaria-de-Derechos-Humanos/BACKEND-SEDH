import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Permisos Personales')
@Controller('recursos-humanos/permisos-personales')
export class PermisosPersonalesController {}
