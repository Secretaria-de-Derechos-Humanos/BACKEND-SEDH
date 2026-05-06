import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoSolicitud } from '../entities/solicitud-empleado.entity';

export class CrearSolicitudEmpleadoDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  empleadoId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  codigoEmpleado: string;

  @ApiProperty({ enum: ['constancia', 'certificado', 'anticipo_sueldo', 'documento', 'otro'] })
  @IsEnum(['constancia', 'certificado', 'anticipo_sueldo', 'documento', 'otro'])
  tipoSolicitud: TipoSolicitud;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  descripcion: string;
}
