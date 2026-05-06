import { IsString, IsOptional, IsBoolean, IsDateString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearEmpleadoDto {
  @ApiProperty()
  @IsString()
  @Length(1, 50)
  emailInstitucional: string;

  @ApiProperty()
  @IsString()
  @Length(1, 50)
  priNombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 50)
  segNombre?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 50)
  priApellido: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 50)
  segApellido?: string;

  @ApiProperty()
  @IsDateString()
  fecIngLaboral: string;

  @ApiProperty()
  @IsString()
  @Length(1, 15)
  numIdentidad: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 9)
  numTelefono?: string;

  @ApiProperty()
  @IsString()
  idTipoContratacion: string;

  @ApiProperty()
  idCargo: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 15)
  idSupInmediato?: string;

  @ApiProperty()
  @IsString()
  idSexo: string;

  @ApiProperty()
  @IsString()
  idEstadoCivil: string;

  @ApiPropertyOptional()
  @IsOptional()
  idMunicipio?: number;
}
