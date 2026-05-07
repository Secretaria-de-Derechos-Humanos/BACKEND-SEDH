import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'departamentos', schema: 'rrhh' })
export class Departamento {
  @PrimaryColumn({ name: 'iddepartamento', type: 'smallint' })
  idDepartamento!: number;

  @Column({ name: 'nomdepartamento', type: 'varchar', length: 50 })
  nomDepartamento!: string;
}
