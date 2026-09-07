import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CrearCargoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nomCargo!: string;

  @IsInt()
  @Min(1)
  idDependencia!: number;
}
