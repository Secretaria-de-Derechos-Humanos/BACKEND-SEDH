import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class CrearConstanciaDto {
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Debe seleccionar al menos una finalidad',
  })
  @IsString({ each: true })
  @IsIn(['PERSONAL', 'INJUPEM', 'SIAFI'], {
    each: true,
    message: 'La finalidad seleccionada no es válida',
  })
  finalidades!: string[];

  @IsNotEmpty({
    message: 'Debe seleccionar la modalidad de salario',
  })
  @IsString()
  @IsIn(['CON_DEDUCCIONES', 'SIN_DEDUCCIONES'], {
    message: 'La modalidad de salario debe ser CON_DEDUCCIONES o SIN_DEDUCCIONES',
  })
  modalidadSalario!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Las observaciones no pueden superar los 500 caracteres',
  })
  observaciones?: string;
}
