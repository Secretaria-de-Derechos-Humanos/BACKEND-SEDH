import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RestablecerPasswordDto {
  @ApiProperty({
    example: 'Temporal2026',
    description: 'Nueva contraseña temporal del usuario',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  nuevaPassword!: string;
}
