import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class AprobarVacacionesDto {
  @ApiPropertyOptional({
    example: 'Aprobación correspondiente a la solicitud de vacaciones.',
    description: 'Observación opcional de la aprobación.',
  })
  @IsOptional()
  @IsString({
    message: 'La observación debe ser texto',
  })
  @MaxLength(500, {
    message: 'La observación no puede superar 500 caracteres',
  })
  observacion?: string;
}
