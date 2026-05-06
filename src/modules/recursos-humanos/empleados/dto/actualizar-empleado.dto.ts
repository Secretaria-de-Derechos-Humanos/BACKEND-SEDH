import { PartialType } from '@nestjs/swagger';
import { CrearEmpleadoDto } from './crear-empleado.dto';

export class ActualizarEmpleadoDto extends PartialType(CrearEmpleadoDto) {}
