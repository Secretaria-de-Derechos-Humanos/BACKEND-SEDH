import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class JefeInmediatoDto {
  @ApiProperty({ example: '0801-1977-05040' })
  @IsString()
  @IsNotEmpty()
  identidad!: string;
}

class NuevoEmpleadoDto {
  @ApiProperty({ example: 'nuevo.empleado@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'JUAN' })
  @IsString()
  @IsNotEmpty()
  primerNombre!: string;

  @ApiPropertyOptional({ example: 'CARLOS' })
  @IsOptional()
  @IsString()
  segundoNombre?: string;

  @ApiProperty({ example: 'PEREZ' })
  @IsString()
  @IsNotEmpty()
  primerApellido!: string;

  @ApiPropertyOptional({ example: 'LOPEZ' })
  @IsOptional()
  @IsString()
  segundoApellido?: string;

  @ApiProperty({ example: '2026-05-12' })
  @IsDateString()
  fechaIngreso!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  activo!: boolean;

  @ApiProperty({ example: '0801-1998-12345' })
  @IsString()
  @IsNotEmpty()
  identidad!: string;

  @ApiPropertyOptional({ example: '9999-8888' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ example: 'b2d25425-d14a-471e-8d2f-806b5a4c197f' })
  @IsUUID()
  idTipoContratacion!: string;

  @ApiProperty({ example: 111 })
  @IsInt()
  @IsPositive()
  idCargo!: number;

  @ApiProperty({ example: 'a1b2189e-491d-47df-bd43-25092dfcd017' })
  @IsUUID()
  idSexo!: string;

  @ApiProperty({ example: '79ed1e4e-972b-4797-8411-7c272371f71a' })
  @IsUUID()
  idEstadoCivil!: string;

  @ApiPropertyOptional({ example: 293 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idMunicipio?: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => JefeInmediatoDto)
  jefeInmediato!: JefeInmediatoDto;
}

class AccesoSistemaDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idRol!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idModulo!: number;
}

export class CrearEmpleadoAdminDto {
  @ApiProperty({
    example: 'issis.caceres@sedh.gob.hn',
    description: 'Email del administrador RRHH',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idmodulo!: number;

  @ApiProperty({ example: 'Temporal2026' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  contrasena!: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => NuevoEmpleadoDto)
  empleado!: NuevoEmpleadoDto;

  @ApiProperty({ type: [AccesoSistemaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccesoSistemaDto)
  accesosSistema!: AccesoSistemaDto[];
}
