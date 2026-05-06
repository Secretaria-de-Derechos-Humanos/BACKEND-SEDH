import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'empleado@sedh.gob' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'P@ssw0rd123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
