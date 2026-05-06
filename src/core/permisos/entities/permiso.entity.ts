import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EntidadAuditoria } from '../../../shared/database/base-audit.entity';
import { Modulo } from '../../modulos/entities/modulo.entity';

@Entity({ name: 'permisos', schema: 'core' })
export class Permiso extends EntidadAuditoria {
  @PrimaryColumn({ name: 'idpermiso', type: 'smallint' })
  idPermiso: number;

  @Column({ name: 'idmodulo', type: 'smallint' })
  idModulo: number;

  @Column({ name: 'nompermiso', type: 'varchar', length: 80 })
  nomPermiso: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  descripcion: string | null;

  @ManyToOne(() => Modulo, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'idmodulo' })
  modulo: Modulo;
}
