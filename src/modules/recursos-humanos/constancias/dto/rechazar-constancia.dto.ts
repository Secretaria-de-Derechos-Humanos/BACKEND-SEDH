import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RechazarConstanciaDto {
  @IsNotEmpty({
    message: 'Debe indicar el motivo del rechazo',
  })
  @IsString()
  @MinLength(5, {
    message: 'El motivo del rechazo debe tener al menos 5 caracteres',
  })
  @MaxLength(200, {
    message: 'El motivo del rechazo no puede superar los 200 caracteres',
  })
  motivoRechazo!: string;
}
