import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class CargarSolicitudesAgenteDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador del módulo de Recursos Humanos',
  })
  @Type(() => Number)
  @IsInt({
    message: 'El id del módulo debe ser un número entero',
  })
  @IsPositive({
    message: 'El id del módulo debe ser mayor que cero',
  })
  idmodulo!: number;
}
