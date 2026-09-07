import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ActualizarCargoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nomCargo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  idDependencia?: number;
}
