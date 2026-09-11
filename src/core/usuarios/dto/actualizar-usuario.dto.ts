import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ArrayNotEmpty,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class ActualizarUsuarioDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({
    required: false,
    type: [Number],
    example: [1, 5],
    description: 'Roles que tendrá el usuario. Permite múltiples roles.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  idRoles?: number[];

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsInt()
  idDependencia?: number;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  contrasena?: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  actualizadoPor?: string;
}
