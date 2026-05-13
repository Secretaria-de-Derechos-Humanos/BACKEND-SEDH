import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsPositive } from 'class-validator';

export class CargarPendientesJefeDto {
  @ApiProperty({ example: 'emerson.duron@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  modulo?: number;

  @ApiPropertyOptional({ example: 1, deprecated: true })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  idmodulo?: number;
}
