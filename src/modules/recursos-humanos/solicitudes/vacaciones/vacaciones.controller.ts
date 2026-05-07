import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Vacaciones')
@Controller('recursos-humanos/vacaciones')
export class VacacionesController {}

