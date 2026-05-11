import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class ResponderSolicitudJefeDto {
  @ApiProperty({ example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a' })
  @IsUUID()
  @IsNotEmpty()
  idpermiso!: string;

  @ApiProperty({ enum: ['PERMISO PERSONAL', 'PERMISO OFICIAL'] })
  @IsIn(['PERMISO PERSONAL', 'PERMISO OFICIAL'])
  @IsNotEmpty()
  tipo!: string;

  @ApiProperty({ example: 'emerson.duron@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idmodulo!: number;

  @ApiPropertyOptional({ example: 'Motivo del rechazo', nullable: true })
  @IsString()
  @IsOptional()
  motRechazo?: string | null;

  @ApiProperty({ example: '01:00', description: 'Horas aprobadas. Usar 00:00 para permisos oficiales.' })
  @IsString()
  @IsNotEmpty()
  horas!: string;
}
