import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsPositive, IsString, IsNotEmpty } from 'class-validator';

export class RegistrarHoraRetornoDto {
  @ApiProperty({ example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a' })
  @IsString()
  @IsNotEmpty()
  idpermiso: string;

  @ApiProperty({ example: 'PERMISO PERSONAL', enum: ['PERMISO PERSONAL', 'PERMISO OFICIAL'] })
  @IsIn(['PERMISO PERSONAL', 'PERMISO OFICIAL'])
  tipo: string;

  @ApiProperty({ example: 'marlon.escobar@sedh.gob.hn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '08:45' })
  @IsString()
  @IsNotEmpty()
  horaRetorno: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @IsPositive()
  rol: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idmodulo: number;
}
