import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegistrarJustificacionLlegadaTardiaDto {
  @IsEmail()
  emailEmpleado!: string;

  @IsDateString()
  fechaLlegada!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'La hora de llegada debe tener el formato HH:mm o HH:mm:ss',
  })
  horaLlegadaReal!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  motivo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
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
