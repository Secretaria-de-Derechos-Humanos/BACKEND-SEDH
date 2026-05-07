import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Módulos')
@Controller('modulos')
export class ModulosController {}
