import { IsIn, IsInt, IsNotEmpty, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AjusteSaldoVacacionesDto {
  @ApiProperty({
    example: 'b2d25425-d14a-471e-8d2f-806b5a4c197f',
    description: 'UUID del empleado.',
  })
  @IsUUID()
  idUsuario!: string;

  @ApiProperty({
    example: 'DESCONTAR',
    enum: ['AGREGAR', 'DESCONTAR'],
    description: 'Tipo de ajuste.',
  })
  @IsIn(['AGREGAR', 'DESCONTAR'])
  tipo!: 'AGREGAR' | 'DESCONTAR';

  @ApiProperty({
    example: 2,
    description: 'Cantidad de días del ajuste.',
  })
  @IsInt()
  @Min(1)
  @Max(365)
  dias!: number;

  @ApiProperty({
    example: 'Semana institucional autorizada por Recursos Humanos.',
    description: 'Justificación obligatoria.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  justificacion!: string;
}
