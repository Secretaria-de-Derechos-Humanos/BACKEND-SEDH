import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class RechazarVacacionesDto {
  @ApiProperty({
    example: 'No es posible aprobar las vacaciones para las fechas solicitadas.',
    description: 'Motivo obligatorio del rechazo.',
  })
  @IsString({
    message: 'El motivo de rechazo debe ser texto',
  })
  @IsNotEmpty({
    message: 'El motivo de rechazo es obligatorio',
  })
  @MaxLength(500, {
    message: 'El motivo de rechazo no puede superar 500 caracteres',
  })
  motivoRechazo!: string;
}
