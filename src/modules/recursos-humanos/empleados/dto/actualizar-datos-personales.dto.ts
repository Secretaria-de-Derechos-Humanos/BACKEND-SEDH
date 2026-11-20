import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

export class ActualizarDatosPersonalesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  priNombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  segNombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  priApellido?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  segApellido?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numIdentidad?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idSexo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  idEstadoCivil?: string;

  @ApiPropertyOptional({ example: 293, nullable: true })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idMunicipio?: number | null;
}
