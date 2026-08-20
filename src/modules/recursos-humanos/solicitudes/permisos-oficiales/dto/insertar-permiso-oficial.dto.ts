import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class InsertarPermisoOficialDto {
  @ApiProperty({
    example: '2026-05-04',
    description: 'Fecha del permiso oficial',
  })
  @IsDateString(
    {},
    {
      message: 'La fecha debe tener un formato válido YYYY-MM-DD',
    },
  )
  @IsNotEmpty({
    message: 'La fecha es obligatoria',
  })
  fecha!: string;

  @ApiProperty({
    example: 'Participación en capacitación institucional',
    description: 'Motivo del permiso oficial',
  })
  @IsString({
    message: 'El motivo debe ser texto',
  })
  @IsNotEmpty({
    message: 'El motivo es obligatorio',
  })
  @MaxLength(500, {
    message: 'El motivo no puede superar los 500 caracteres',
  })
  motivo!: string;
}
