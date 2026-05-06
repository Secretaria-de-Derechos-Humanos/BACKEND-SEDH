import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoPermiso } from '../entities/reporte-permiso.entity';

export class CrearReportePermisoDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  empleadoId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  codigoEmpleado: string;

  @ApiProperty({ enum: ['vacaciones', 'enfermedad', 'personal', 'maternidad', 'paternidad', 'otro'] })
  @IsEnum(['vacaciones', 'enfermedad', 'personal', 'maternidad', 'paternidad', 'otro'])
  tipoPermiso: TipoPermiso;

  @ApiProperty({ example: '2026-05-10' })
  @IsDateString()
  fechaInicio: string;

  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  fechaFin: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  motivo?: string;
}
