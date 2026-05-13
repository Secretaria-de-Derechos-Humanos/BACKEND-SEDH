import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsPositive } from 'class-validator';

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
  modulo!: number;

  @ApiProperty({ example: 1, required: false, deprecated: true })
  @IsInt()
  @IsPositive()
  @IsOptional()
  idmodulo?: number;
}
