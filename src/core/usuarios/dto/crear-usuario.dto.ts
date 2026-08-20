import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearUsuarioDto {
  @ApiProperty({
    example: 'JUAN',
    description: 'Primer nombre del usuario',
  })
  @IsString()
  @MaxLength(50)
  priNombre!: string;

  @ApiPropertyOptional({
    example: 'ANTONIO',
    description: 'Segundo nombre del usuario',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  segNombre?: string | null;

  @ApiProperty({
    example: 'PEREZ',
    description: 'Primer apellido del usuario',
  })
  @IsString()
  @MaxLength(50)
  priApellido!: string;

  @ApiPropertyOptional({
    example: 'LOPEZ',
    description: 'Segundo apellido del usuario',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  segApellido?: string | null;

  @ApiProperty({
    example: 'juan.perez@sedh.gob.hn',
  })
  @IsEmail(
    {},
    {
      message: 'El correo institucional no es válido',
    },
  )
  @MaxLength(50)
  emailInstitucional!: string;

  @ApiProperty({
    example: 'Contrasena@123',
  })
  @IsString()
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'La contraseña debe tener mayúscula, minúscula, número y carácter especial',
  })
  contrasena!: string;

  @ApiProperty({
    example: 1,
    description: 'Rol que se asignará al usuario',
  })
  @IsInt()
  idRol!: number;

  @ApiPropertyOptional({
    example: 'admin.rrhh@sedh.gob.hn',
  })
  @IsOptional()
  @IsString()
  creadoPor?: string;
}
