import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoSolicitud } from '../entities/solicitud-empleado.entity';

export class ActualizarSolicitudEmpleadoDto {
  @ApiProperty({ enum: ['pendiente', 'en_proceso', 'completado', 'rechazado'] })
  @IsEnum(['pendiente', 'en_proceso', 'completado', 'rechazado'])
  estado: EstadoSolicitud;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  asignadoA?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notasResolucion?: string;
}
