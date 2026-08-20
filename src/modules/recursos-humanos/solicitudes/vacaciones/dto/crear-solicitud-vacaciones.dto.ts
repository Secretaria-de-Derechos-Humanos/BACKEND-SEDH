import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CrearSolicitudVacacionesDto {
  @ApiProperty({
    example: '2026-08-17',
    description: 'Primer día solicitado de vacaciones.',
  })
  @IsDateString()
  fechaInicio!: string;

  @ApiProperty({
    example: '2026-08-21',
    description: 'Último día solicitado de vacaciones.',
  })
  @IsDateString()
  fechaFin!: string;

  @ApiPropertyOptional({
    example: 'Vacaciones correspondientes al período 2026.',
    description: 'Observación opcional de la solicitud.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  observaciones?: string;
}
