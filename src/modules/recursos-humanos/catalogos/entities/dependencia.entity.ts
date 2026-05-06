import { Entity, PrimaryColumn, Column } from 'typeorm';
import { EntidadAuditoria } from '../../../../shared/database/base-audit.entity';

@Entity({ name: 'dependencias', schema: 'rrhh' })
export class Dependencia extends EntidadAuditoria {
  @PrimaryColumn({ name: 'iddependencia', type: 'smallint' })
  idDependencia: number;

  @Column({ name: 'nomdependencia', type: 'varchar', length: 100 })
  nomDependencia: string;
}
