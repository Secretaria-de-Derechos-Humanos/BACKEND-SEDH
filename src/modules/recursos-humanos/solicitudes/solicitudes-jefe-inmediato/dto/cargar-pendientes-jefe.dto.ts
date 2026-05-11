import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export class CargarPendientesJefeDto {
  @ApiProperty({ example: 'emerson.duron@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idmodulo!: number;
}
