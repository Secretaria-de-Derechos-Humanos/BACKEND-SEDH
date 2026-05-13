import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class ResponderSolicitudSubgerenteDto {
  @ApiProperty({ example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a' })
  @IsUUID()
  @IsNotEmpty()
  idpermiso!: string;

  @ApiProperty({ enum: ['PERMISO PERSONAL', 'PERMISO OFICIAL'] })
  @IsIn(['PERMISO PERSONAL', 'PERMISO OFICIAL'])
  @IsNotEmpty()
  tipo!: string;

  @ApiProperty({ example: 'katia.pinto@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  modulo?: number;

  @ApiPropertyOptional({ example: 1, deprecated: true })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  idmodulo?: number;

  @ApiPropertyOptional({ example: 'No procede', nullable: true })
  @IsString()
  @IsOptional()
  motRechazo?: string | null;

  @ApiPropertyOptional({
    example: '02:00:00',
    nullable: true,
    description: 'Solo requerido cuando se rechaza un permiso personal para devolver horas.',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'horas debe tener formato HH:MM o HH:MM:SS',
  })
  @IsOptional()
  horas?: string | null;
}
