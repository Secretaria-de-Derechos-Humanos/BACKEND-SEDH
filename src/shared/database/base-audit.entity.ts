import { Column } from 'typeorm';

/**
 * Columnas de auditoría comunes en las tablas de la BD.
 * Las tablas que no tienen estas columnas no extienden esta clase.
 */
export abstract class EntidadAuditoria {
  @Column({ name: 'creadoen', type: 'date', nullable: true, default: () => 'CURRENT_DATE' })
  creadoEn: Date | null;

  @Column({ name: 'creadopor', type: 'varchar', length: 50, nullable: true })
  creadoPor: string | null;

  @Column({ name: 'actualizadoen', type: 'date', nullable: true })
  actualizadoEn: Date | null;

  @Column({ name: 'actualizadopor', type: 'varchar', length: 50, nullable: true })
  actualizadoPor: string | null;
}
