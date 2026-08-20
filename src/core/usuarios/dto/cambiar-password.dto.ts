import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty()
  passwordActual!: string;
  @IsString()
  @IsNotEmpty()
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(100)
  nuevaPassword!: string;
}
