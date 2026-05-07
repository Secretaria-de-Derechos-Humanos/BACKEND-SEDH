import { IsEmail, IsString, MinLength, Matches, IsOptional, IsNumber, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'juan.perez@sedh.gob' })
  @IsEmail()
  emailInstitucional!: string;

  @ApiProperty({ example: 'Contrasena@123' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'La contraseña debe tener mayúscula, minúscula, número y carácter especial',
  })
  contrasena!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  idRol!: number;

  @ApiProperty({ example: 'admin@sedh.gob', required: false })
  @IsOptional()
  @IsString()
  creadoPor?: string;
}
