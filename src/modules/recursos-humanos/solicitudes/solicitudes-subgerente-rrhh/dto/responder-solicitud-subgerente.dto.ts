import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

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
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idmodulo!: number;

  @ApiPropertyOptional({ example: 'No procede', nullable: true })
  @IsString()
  @IsOptional()
  motRechazo?: string | null;

  @ApiPropertyOptional({ example: '01:00', nullable: true, description: 'Horas a devolver al rechazar permiso personal. Null para oficiales.' })
  @IsString()
  @IsOptional()
  horas?: string | null;
}
