import { Entity, PrimaryColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { EntidadAuditoria } from '../../../shared/database/base-audit.entity';
import { Modulo } from '../../modulos/entities/modulo.entity';

@Entity({ name: 'roles', schema: 'core' })
export class Rol extends EntidadAuditoria {
  @PrimaryColumn({ name: 'idrol', type: 'smallint' })
  idRol!: number;

  @Column({ name: 'nomrol', type: 'varchar', length: 50 })
  nomRol!: string;

  @ManyToMany(() => Modulo, { eager: true })
  @JoinTable({
    name: 'roles_modulos',
    schema: 'core',
    joinColumn: { name: 'idrol', referencedColumnName: 'idRol' },
    inverseJoinColumn: { name: 'idmodulo', referencedColumnName: 'idModulo' },
  })
  modulos!: Modulo[];
}
