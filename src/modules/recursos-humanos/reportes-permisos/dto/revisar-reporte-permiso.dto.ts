import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RevisarReportePermisoDto {
  @ApiProperty({ enum: ['aprobado', 'rechazado'] })
  @IsEnum(['aprobado', 'rechazado'])
  estado: 'aprobado' | 'rechazado';

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  revisadoPor: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notasRevision?: string;
}
