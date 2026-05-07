import { Entity, PrimaryColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { EntidadAuditoria } from '../../../shared/database/base-audit.entity';
import { Permiso } from '../../permisos/entities/permiso.entity';

@Entity({ name: 'roles', schema: 'core' })
export class Rol extends EntidadAuditoria {
  @PrimaryColumn({ name: 'idrol', type: 'smallint' })
  idRol!: number;

  @Column({ name: 'nomrol', type: 'varchar', length: 50 })
  nomRol!: string;

  @ManyToMany(() => Permiso, { eager: true })
  @JoinTable({
    name: 'roles_permisos',
    schema: 'core',
    joinColumn: { name: 'idrol', referencedColumnName: 'idRol' },
    inverseJoinColumn: { name: 'idpermiso', referencedColumnName: 'idPermiso' },
  })
  permisos!: Permiso[];
}
