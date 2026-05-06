import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Verify2faDto {
  @ApiProperty({ example: 'empleado@sedh.gob' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: 'Código TOTP de 6 dígitos' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'El código TOTP debe tener exactamente 6 dígitos' })
  token: string;
}
