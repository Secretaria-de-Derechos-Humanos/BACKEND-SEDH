import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { EntidadAuditoria } from '../../../shared/database/base-audit.entity';

@Entity({ name: 'modulos', schema: 'core' })
export class Modulo extends EntidadAuditoria {
  @PrimaryColumn({ name: 'idmodulo', type: 'smallint' })
  idModulo: number;

  @Column({ name: 'nommodulo', type: 'varchar', length: 50 })
  nomModulo: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  descripcion: string | null;
}
