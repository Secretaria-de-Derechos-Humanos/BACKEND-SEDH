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
}
