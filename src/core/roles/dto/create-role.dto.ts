import { IsNotEmpty, IsOptional, IsString, IsArray, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'Subgerente de RRHH' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Acceso a módulo de recursos humanos' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ type: [String], description: 'IDs de permisos a asignar' })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  permissionIds?: string[];
}
