import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class CargarPendientesJefeDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador del módulo',
  })
  @Type(() => Number)
  @IsInt({
    message: 'El módulo debe ser un número entero',
  })
  @IsPositive({
    message: 'El módulo debe ser mayor que cero',
  })
  modulo!: number;
}
