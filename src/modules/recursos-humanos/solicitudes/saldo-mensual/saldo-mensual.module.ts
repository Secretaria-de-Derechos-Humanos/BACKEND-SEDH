import { Module } from '@nestjs/common';
import { SaldoMensualService } from './saldo-mensual.service';

@Module({
  providers: [SaldoMensualService],
  exports: [SaldoMensualService],
})
export class SaldoMensualModule {}
