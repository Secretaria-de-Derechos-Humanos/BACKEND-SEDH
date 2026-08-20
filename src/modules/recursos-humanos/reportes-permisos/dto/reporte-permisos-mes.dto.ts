import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, Max, Min } from 'class-validator';

export class ReportePermisosMesDto {
  @ApiProperty({
    example: 5,
    description: 'Mes del reporte, entre 1 y 12',
  })
  @Type(() => Number)
  @IsInt({
    message: 'El mes debe ser un número entero',
  })
  @Min(1, {
    message: 'El mes debe ser mayor o igual a 1',
  })
  @Max(12, {
    message: 'El mes debe ser menor o igual a 12',
  })
  mes!: number;

  @ApiProperty({
    example: 2026,
    description: 'Año del reporte',
  })
  @Type(() => Number)
  @IsInt({
    message: 'El año debe ser un número entero',
  })
  @Min(2000, {
    message: 'El año no es válido',
  })
  anio!: number;

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
  idmodulo!: number;
}
