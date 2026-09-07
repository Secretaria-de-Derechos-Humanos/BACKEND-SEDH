import { IsBoolean, IsNotEmpty } from 'class-validator';

export class MarcarNotificacionLeidaDto {
  @IsBoolean()
  @IsNotEmpty()
  leida!: boolean;
}
