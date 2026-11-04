import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class SaldoMensualService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SaldoMensualService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Verificando período mensual de saldos...');
    await this.inicializarPeriodoVigente();
  }

  @Cron('0 5 0 1 * *', {
    timeZone: 'America/Tegucigalpa',
  })
  async ejecutarReinicioMensual(): Promise<void> {
    this.logger.log('Ejecutando reinicio mensual de saldos...');
    await this.inicializarPeriodoVigente();
  }

  async inicializarPeriodoVigente(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      // Evitar que dos instancias reinicien los saldos simultáneamente.
      const bloqueo = await queryRunner.query(`
        SELECT pg_try_advisory_xact_lock(20261103, 1) AS adquirido
      `);

      if (!bloqueo[0]?.adquirido) {
        await queryRunner.rollbackTransaction();
        this.logger.warn('Otra instancia está procesando los saldos.');
        return;
      }

      // Fecha y período calculados con la zona horaria de Honduras.
      const resultado = await queryRunner.query(`
        SELECT
          DATE_TRUNC(
            'month',
            CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa'
          )::date AS periodo,
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/Tegucigalpa')::date AS fecha
      `);

      const periodo = resultado[0].periodo;
      const fecha = resultado[0].fecha;

      // Solo reinicia los registros que todavía pertenecen a otro período.
      // Los saldos ya inicializados en el mes actual se conservan.
      const actualizados = await queryRunner.query(
        `
        UPDATE rrhh.horas_disponibles
        SET
          hordisponibles = TIME '09:00:00',
          periodo_saldo = $1::date,
          actualizadoen = $2::date,
          actualizadopor = 'SISTEMA_SALDO_MENSUAL'
        WHERE periodo_saldo IS DISTINCT FROM $1::date
        RETURNING emailinstitucional
        `,
        [periodo, fecha],
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Período ${periodo} verificado. Empleados reiniciados: ${actualizados.length}.`,
      );
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      this.logger.error(
        'Error al inicializar el período mensual.',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
