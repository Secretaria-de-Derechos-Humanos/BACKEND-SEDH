import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoAsistencia } from '../entities/asistencia.entity';

export class CrearAsistenciaDto {
  @ApiProperty({ example: 'uuid-del-empleado' })
  @IsUUID()
  @IsNotEmpty()
  empleadoId: string;

  @ApiProperty({ example: 'EMP-001' })
  @IsString()
  @IsNotEmpty()
  codigoEmpleado: string;

  @ApiProperty({ example: '2026-05-06' })
  @IsDateString()
  fechaAsistencia: string;

  @ApiPropertyOptional({ example: '08:00:00' })
  @IsString()
  @IsOptional()
  horaEntrada?: string;

  @ApiPropertyOptional({ example: '17:00:00' })
  @IsString()
  @IsOptional()
  horaSalida?: string;

  @ApiProperty({ enum: ['presente', 'ausente', 'tardanza', 'justificado'] })
  @IsEnum(['presente', 'ausente', 'tardanza', 'justificado'])
  estado: EstadoAsistencia;
}
