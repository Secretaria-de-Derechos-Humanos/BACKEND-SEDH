import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsPositive, IsString, MinLength } from 'class-validator';

export class BuscarEmpleadoAdminDto {
  @ApiProperty({ example: 'luis.cardona@sedh.gob.hn', description: 'Correo, DNI o nombre del empleado a buscar' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  emailEmpleado!: string;

  @ApiProperty({ example: 'issis.caceres@sedh.gob.hn', description: 'Email del administrador RRHH' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @IsPositive()
  rol!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  idmodulo!: number;
}
