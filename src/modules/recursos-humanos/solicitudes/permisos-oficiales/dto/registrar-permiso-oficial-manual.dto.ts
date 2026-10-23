import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegistrarPermisoOficialManualDto {
  @ApiProperty({
    example: 'empleado@sedh.gob.hn',
  })
  @IsEmail({}, { message: 'El correo del empleado no es válido' })
  @MaxLength(50)
  emailEmpleado!: string;

  @ApiProperty({
    example: '2026-10-20',
  })
  @IsDateString()
  @IsNotEmpty()
  fechaInicio!: string;

  @ApiProperty({
    example: '2026-10-22',
  })
  @IsDateString()
  @IsNotEmpty()
  fechaFinal!: string;

  @ApiProperty({
    example: 'Comisión oficial autorizada en documento físico',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  motivo!: string;

  @ApiPropertyOptional({
    example: 'PO-RRHH-2026-010',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenciaDocumento?: string;

  @ApiPropertyOptional({
    example: '08:00',
    description: 'Hora de salida opcional en formato HH:mm',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de salida debe tener el formato HH:mm',
  })
  horaSalida?: string;

  @ApiPropertyOptional({
    example: '09:30',
    description: 'Hora de regreso opcional en formato HH:mm',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de regreso debe tener el formato HH:mm',
  })
  horaRegreso?: string;

  @ApiPropertyOptional({
    example: 'No regresó a la oficina.',
    description: 'Observación opcional, máximo 500 caracteres',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'La observación no puede superar los 500 caracteres',
  })
  observacion?: string;
}
