import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EntidadAuditoria } from '../../../../shared/database/base-audit.entity';
import { Dependencia } from './dependencia.entity';

@Entity({ name: 'cargos', schema: 'rrhh' })
export class Cargo extends EntidadAuditoria {
  @PrimaryColumn({ name: 'idcargo', type: 'smallint' })
  idCargo: number;

  @Column({ name: 'nomcargo', type: 'varchar', length: 100, nullable: true })
  nomCargo: string | null;

  @Column({ name: 'iddependencia', type: 'smallint' })
  idDependencia: number;

  @ManyToOne(() => Dependencia, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'iddependencia' })
  dependencia: Dependencia;
}
