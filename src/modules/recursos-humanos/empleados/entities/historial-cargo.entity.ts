import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { EntidadAuditoria } from '../../../../shared/database/base-audit.entity';

@Entity({ name: 'historial_cargos', schema: 'rrhh' })
export class HistorialCargo extends EntidadAuditoria {
  @PrimaryGeneratedColumn('uuid', { name: 'idhistocargo' })
  idHistoCargo: string;

  @Column({ name: 'emailinstitucional', type: 'varchar', length: 50 })
  emailInstitucional: string;

  @Column({ name: 'idcargo', type: 'smallint', nullable: true })
  idCargo: number | null;

  @Column({ name: 'fecinicio', type: 'date', nullable: true })
  fecInicio: Date | null;

  @Column({ name: 'fecfin', type: 'date', nullable: true })
  fecFin: Date | null;
}
