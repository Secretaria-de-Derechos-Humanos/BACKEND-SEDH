import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActualizarUsuarioDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({
    required: false,
    type: Number,
    example: 5,
    description: 'Rol que tendrá el usuario.',
  })
  @IsOptional()
  @IsInt()
  idRol?: number;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsInt()
  idDependencia?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  contrasena?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  actualizadoPor?: string;
}
