import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class InsertarPermisoPersonalDto {
  @ApiProperty({
    example: '2026-08-05',
    description: 'Fecha del permiso en formato YYYY-MM-DD',
  })
  @IsDateString(
    {},
    {
      message: 'La fecha debe tener el formato YYYY-MM-DD',
    },
  )
  @IsNotEmpty({
    message: 'La fecha es obligatoria',
  })
  fecha!: string;

  @ApiProperty({
    example: '01:30',
    description: 'Tiempo solicitado en formato HH:mm. El máximo diario es de 03:00.',
  })
  @IsString()
  @IsNotEmpty({
    message: 'Las horas son obligatorias',
  })
  @Matches(/^(0[0-2]:[0-5]\d|03:00)$/, {
    message: 'El tiempo debe tener el formato HH:mm y no puede superar 03:00',
  })
  horas!: string;

  @ApiProperty({
    example: 'Asunto personal',
  })
  @IsString()
  @IsNotEmpty({
    message: 'El motivo es obligatorio',
  })
  @MaxLength(500, {
    message: 'El motivo no puede superar los 500 caracteres',
  })
  motivo!: string;

  @ApiProperty({
    example: false,
  })
  @IsBoolean({
    message: 'Emergencia debe ser verdadero o falso',
  })
  emergencia!: boolean;
}
