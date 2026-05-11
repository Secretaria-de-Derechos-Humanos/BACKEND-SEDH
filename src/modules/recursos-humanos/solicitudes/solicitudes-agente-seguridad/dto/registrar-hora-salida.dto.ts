import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsPositive, IsString, IsUUID } from 'class-validator';

export class RegistrarHoraSalidaDto {
  @ApiProperty({ example: 'a0fd92e2-82cd-4781-af3a-7e6e1879e72a' })
  @IsUUID()
  @IsNotEmpty()
  idpermiso!: string;

  @ApiProperty({ enum: ['PERMISO PERSONAL', 'PERMISO OFICIAL'] })
  @IsIn(['PERMISO PERSONAL', 'PERMISO OFICIAL'])
  @IsNotEmpty()
  tipo!: string;

  @ApiProperty({ example: 'marlon.escobar@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '08:30' })
  @IsString()
  @IsNotEmpty()
  horaSalida!: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idmodulo!: number;
}
