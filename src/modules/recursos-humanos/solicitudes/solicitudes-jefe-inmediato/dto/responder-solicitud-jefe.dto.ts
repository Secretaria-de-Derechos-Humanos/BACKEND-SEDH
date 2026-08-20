import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ResponderSolicitudJefeDto {
  @ApiProperty({
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
    description: 'UUID real del permiso',
  })
  @IsUUID('4', {
    message: 'El identificador del permiso debe ser un UUID válido',
  })
  @IsNotEmpty({
    message: 'El identificador del permiso es obligatorio',
  })
  idpermiso!: string;

  @ApiProperty({
    example: 'PERMISO PERSONAL',
    enum: ['PERMISO PERSONAL', 'PERMISO OFICIAL'],
  })
  @IsString()
  @IsIn(['PERMISO PERSONAL', 'PERMISO OFICIAL'], {
    message: 'El tipo debe ser PERMISO PERSONAL o PERMISO OFICIAL',
  })
  tipo!: string;

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
  modulo!: number;

  @ApiPropertyOptional({
    example: 'La documentación presentada es insuficiente',
    description: 'Motivo del rechazo. Si no se envía, la solicitud se considera aprobada.',
  })
  @IsOptional()
  @IsString({
    message: 'El motivo de rechazo debe ser texto',
  })
  @MaxLength(500, {
    message: 'El motivo de rechazo no puede superar 500 caracteres',
  })
  motRechazo?: string;

  @ApiPropertyOptional({
    example: '02:00',
    description:
      'Horas asociadas al rechazo de un permiso personal, según el formato esperado por PostgreSQL',
  })
  @IsOptional()
  @IsString({
    message: 'Las horas deben enviarse como texto',
  })
  horas?: string;
}
