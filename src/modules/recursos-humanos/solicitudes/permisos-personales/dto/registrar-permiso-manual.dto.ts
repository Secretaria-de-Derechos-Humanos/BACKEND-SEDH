import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegistrarPermisoManualDto {
  @ApiProperty({
    example: 'empleado@sedh.gob.hn',
    description: 'Correo institucional del empleado',
  })
  @IsEmail({}, { message: 'El correo del empleado no es válido' })
  @MaxLength(50)
  emailEmpleado!: string;

  @ApiProperty({
    example: '2026-10-20',
    description: 'Fecha del permiso en formato YYYY-MM-DD',
  })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  fecha!: string;

  @ApiProperty({
    example: '01:30',
    description: 'Tiempo autorizado en formato HH:mm; máximo 03:00',
  })
  @IsString()
  @Matches(/^(0[0-2]:[0-5][0-9]|03:00)$/, {
    message: 'El tiempo debe ser mayor que 00:00 y no superar 03:00',
  })
  @IsNotEmpty({ message: 'Las horas son obligatorias' })
  horas!: string;

  @ApiProperty({
    example: 'Cita médica autorizada y documentada en papel',
    description: 'Motivo del permiso',
  })
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(200, {
    message: 'El motivo no puede superar los 200 caracteres',
  })
  motivo!: string;

  @ApiPropertyOptional({
    example: 'PER-RRHH-2026-015',
    description: 'Referencia opcional del documento físico',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'La referencia no puede superar los 100 caracteres',
  })
  referenciaDocumento?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si el permiso corresponde a una emergencia',
  })
  @IsOptional()
  @IsBoolean()
  emergencia?: boolean;
}
