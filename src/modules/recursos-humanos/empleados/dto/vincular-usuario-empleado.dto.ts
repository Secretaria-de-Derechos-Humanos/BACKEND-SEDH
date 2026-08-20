import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class DatosVinculacionEmpleadoDto {
  @ApiProperty({
    example: '2026-07-07',
  })
  @IsDateString()
  fecIngLaboral!: string;

  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  actLaboralmente!: boolean;

  @ApiProperty({
    example: '1503200102370',
  })
  @IsString()
  @IsNotEmpty()
  numIdentidad!: string;

  @ApiPropertyOptional({
    example: '97439181',
  })
  @IsOptional()
  @IsString()
  numTelefono?: string | null;

  @ApiProperty({
    example: 'b2d25425-d14a-471e-8d2f-806b5a4c197f',
  })
  @IsUUID()
  idTipoContratacion!: string;

  @ApiProperty({
    example: 139,
  })
  @IsInt()
  @IsPositive()
  idCargo!: number;

  @ApiPropertyOptional({
    example: '0801-1989-09333',
  })
  @IsOptional()
  @IsString()
  idSupInmediato?: string | null;

  @ApiProperty({
    example: '786ced61-5c18-4509-95b0-df49c43f4abc',
  })
  @IsUUID()
  idSexo!: string;

  @ApiProperty({
    example: '9f9001eb-324b-4757-9d03-683ce5682abc',
  })
  @IsUUID()
  idEstadoCivil!: string;

  @ApiPropertyOptional({
    example: 109,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idMunicipio?: number | null;
}

export class VincularUsuarioEmpleadoDto {
  @ApiProperty({
    example: '596b0ca7-61f3-4204-9787-40fe5fbb...',
  })
  @IsUUID()
  idUsuario!: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => DatosVinculacionEmpleadoDto)
  empleado!: DatosVinculacionEmpleadoDto;
}
