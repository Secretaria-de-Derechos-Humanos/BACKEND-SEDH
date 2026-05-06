import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'usuario@sedh.gob.hn' })
  @IsEmail({}, { message: 'El correo no es válido' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'MiContrasena' })
  @IsString()
  @IsNotEmpty()
  contrasena: string;
}
