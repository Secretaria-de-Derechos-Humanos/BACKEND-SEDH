import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsPositive, IsString, IsUUID, Matches } from 'class-validator';

export class RegistrarHoraRetornoDto {
  @ApiProperty({
    example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a',
  })
  @IsUUID('4', {
    message: 'El identificador del permiso debe ser un UUID válido',
  })
  @IsNotEmpty({
    message: 'El identificador del permiso es obligatorio',
  })
  idPermiso!: string;

  @ApiProperty({
    example: '16:45',
  })
  @IsString()
  @IsNotEmpty({
    message: 'La hora de retorno es obligatoria',
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de retorno debe tener el formato HH:mm',
  })
  horaRetorno!: string;

  @ApiProperty({
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  idmodulo!: number;
}
