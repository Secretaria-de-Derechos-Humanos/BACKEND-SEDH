import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsPositive } from 'class-validator';

export class ReportePermisosMesDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  @IsPositive()
  mes!: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @IsPositive()
  anio!: number;

  @ApiProperty({ example: 'issis.caceres@sedh.gob.hn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idmodulo!: number;
}
