import { Module } from '@nestjs/common';

import { ReportesPermisosController } from './reportes-permisos.controller';
import { ReportesPermisosService } from './reportes-permisos.service';

@Module({
  controllers: [ReportesPermisosController],
  providers: [ReportesPermisosService],
  exports: [ReportesPermisosService],
})
export class ReportesPermisosModule {}
