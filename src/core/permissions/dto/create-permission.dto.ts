import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionAction } from '../entities/permission.entity';

export class CreatePermissionDto {
  @ApiProperty({ example: 'human-resources', description: 'Nombre del módulo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  module: string;

  @ApiPropertyOptional({ example: 'attendance', description: 'Nombre del submódulo (opcional)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  subModule?: string;

  @ApiProperty({ enum: ['read', 'create', 'update', 'delete', 'manage'] })
  @IsEnum(['read', 'create', 'update', 'delete', 'manage'])
  action: PermissionAction;

  @ApiPropertyOptional({ example: 'Leer registros de asistencia' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
