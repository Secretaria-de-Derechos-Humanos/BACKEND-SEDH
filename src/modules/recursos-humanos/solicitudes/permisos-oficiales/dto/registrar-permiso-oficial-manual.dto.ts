import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegistrarPermisoOficialManualDto {
  @ApiProperty({ example: 'empleado@sedh.gob.hn' })
  @IsEmail({}, { message: 'El correo del empleado no es válido' })
  @MaxLength(50)
  emailEmpleado!: string;

  @ApiProperty({ example: '2026-10-20' })
  @IsDateString()
  @IsNotEmpty()
  fechaInicio!: string;

  @ApiProperty({ example: '2026-10-22' })
  @IsDateString()
  @IsNotEmpty()
  fechaFinal!: string;

  @ApiProperty({ example: 'Comisión oficial autorizada en documento físico' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  motivo!: string;

  @ApiPropertyOptional({ example: 'PO-RRHH-2026-010' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenciaDocumento?: string;
}
