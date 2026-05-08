import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class InsertarPermisoPersonalDto {
  @ApiProperty({ example: 'luis.cardona@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '2026-05-04' })
  @IsDateString()
  @IsNotEmpty()
  fecha!: string;

  @ApiProperty({ example: '01:00', description: 'Horas solicitadas en formato HH:MM' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, { message: 'horas debe tener formato HH:MM' })
  horas!: string;

  @ApiProperty({ example: 'Asunto personal' })
  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  emergencia!: boolean;
}
