import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class BuscarEmpleadoAdminDto {
  @ApiProperty({
    example: 'empleado@sedh.gob.hn',
  })
  @IsEmail()
  @IsNotEmpty()
  emailEmpleado!: string;
}
