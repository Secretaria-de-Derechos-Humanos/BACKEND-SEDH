import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsPositive, IsUUID } from 'class-validator';

export class MarcarNoRetornoDto {
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
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  idmodulo!: number;
}
