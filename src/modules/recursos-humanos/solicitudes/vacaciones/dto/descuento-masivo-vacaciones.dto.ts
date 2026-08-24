import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DescuentoMasivoVacacionesDto {
  @ApiProperty({
    example: ['b2d25425-d14a-471e-8d2f-806b5a4c197f', 'c9a2f2be-5c32-4b1f-b5e1-3c6f5e8e9b7a'],
    description: 'Empleados a los que se aplicará el descuento.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  idUsuarios!: string[];

  @ApiProperty({
    example: 2,
    description: 'Cantidad de días a descontar a cada empleado.',
  })
  @IsInt()
  @Min(1)
  @Max(365)
  dias!: number;

  @ApiProperty({
    example: 'Descuento autorizado por Semana Morazánica.',
    description: 'Justificación obligatoria.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  justificacion!: string;
}
