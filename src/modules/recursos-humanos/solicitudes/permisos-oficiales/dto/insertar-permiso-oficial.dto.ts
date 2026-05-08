import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class InsertarPermisoOficialDto {
  @ApiProperty({ example: 'luis.cardona@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '2026-05-04' })
  @IsDateString()
  @IsNotEmpty()
  fecha!: string;

  @ApiProperty({ example: 'Capacitación personal en ciudad x' })
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}
