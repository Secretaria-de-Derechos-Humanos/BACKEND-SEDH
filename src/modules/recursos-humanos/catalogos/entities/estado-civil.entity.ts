import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'estados_civiles', schema: 'rrhh' })
export class EstadoCivil {
  @PrimaryGeneratedColumn('uuid', { name: 'idestadocivil' })
  idEstadoCivil: string;

  @Column({ name: 'nomestadocivil', type: 'varchar', length: 50 })
  nomEstadoCivil: string;
}
