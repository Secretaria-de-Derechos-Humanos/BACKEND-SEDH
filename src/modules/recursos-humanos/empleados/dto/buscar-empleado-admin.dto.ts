import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsPositive } from 'class-validator';

export class BuscarEmpleadoAdminDto {
  @ApiProperty({ example: 'luis.cardona@sedh.gob.hn', description: 'Email del empleado a buscar' })
  @IsEmail()
  @IsNotEmpty()
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
