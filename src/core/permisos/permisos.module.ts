import { Module } from '@nestjs/common';
import { PermisosController } from './permisos.controller';

@Module({
  controllers: [PermisosController],
})
export class PermisosModule {}
