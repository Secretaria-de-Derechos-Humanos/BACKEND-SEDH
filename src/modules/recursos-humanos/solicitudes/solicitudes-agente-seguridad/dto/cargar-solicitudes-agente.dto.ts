import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export class CargarSolicitudesAgenteDto {
  @ApiProperty({ example: 'marlon.escobar@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idmodulo!: number;
}
