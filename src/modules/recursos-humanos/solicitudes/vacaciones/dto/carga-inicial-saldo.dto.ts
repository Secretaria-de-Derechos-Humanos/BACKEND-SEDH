import { IsInt, IsNotEmpty, IsString, IsUUID, Max, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CargaInicialSaldoDto {
  @ApiProperty({
    example: 'b2d25425-d14a-471e-8d2f-806b5a4c197f',
    description: 'UUID del empleado.',
  })
  @IsUUID()
  idUsuario!: string;

  @ApiProperty({
    example: 2026,
    description: 'Año/período de referencia del saldo inicial.',
  })
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio!: number;

  @ApiProperty({
    example: 12,
    description: 'Días asignados inicialmente.',
  })
  @IsInt()
  @Min(0)
  @Max(365)
  diasAsignados!: number;

  @ApiProperty({
    example: 0,
    description: 'Días ya utilizados.',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @Max(365)
  diasUtilizados!: number;

  @ApiProperty({
    example: 0,
    description: 'Días ya reservados.',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @Max(365)
  diasReservados!: number;

  @ApiProperty({
    example: 'Carga inicial autorizada por Recursos Humanos.',
    description: 'Justificación obligatoria de la carga inicial.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  observacion!: string;
}
