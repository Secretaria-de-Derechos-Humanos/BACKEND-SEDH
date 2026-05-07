import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Empleados')
@Controller('recursos-humanos/empleados')
export class EmpleadosController {}
