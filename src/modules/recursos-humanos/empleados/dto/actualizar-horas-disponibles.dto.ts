import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsPositive, IsString, Matches } from 'class-validator';

export class ActualizarHorasDisponiblesDto {
  @ApiProperty({
    example: 'luis.cardona@sedh.gob.hn',
    description: 'Email del empleado a actualizar',
  })
  @IsEmail()
  @IsNotEmpty()
  emailEmpleado!: string;

  @ApiProperty({
    example: '07:30:00',
    description: 'Horas disponibles del empleado en formato HH:mm:ss',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
    message: 'horasDisponibles debe tener formato HH:mm:ss',
  })
  horasDisponibles!: string;

  @ApiProperty({
    example: 'issis.caceres@sedh.gob.hn',
    description: 'Email del administrador RRHH',
  })
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
