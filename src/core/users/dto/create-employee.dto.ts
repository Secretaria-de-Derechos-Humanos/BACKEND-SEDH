import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
  IsOptional,
  IsBoolean,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'EMP-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  employeeCode: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Pérez García' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'juan.perez@sedh.gob' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'P@ssw0rd123', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'La contraseña debe tener mayúsculas, minúsculas, número y carácter especial',
  })
  password: string;

  @ApiProperty({ example: 'uuid-del-rol' })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;
}
