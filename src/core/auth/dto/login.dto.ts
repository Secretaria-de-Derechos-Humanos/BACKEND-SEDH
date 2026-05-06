import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'usuario@sedh.gob' })
  @IsEmail({}, { message: 'El correo institucional no es válido' })
  @IsNotEmpty()
  emailInstitucional: string;

  @ApiProperty({ example: 'Contrasena@123' })
  @IsString()
  @MinLength(8)
  contrasena: string;
}
