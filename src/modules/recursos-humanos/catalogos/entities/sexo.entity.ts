import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'sexos', schema: 'rrhh' })
export class Sexo {
  @PrimaryGeneratedColumn('uuid', { name: 'idsexo' })
  idSexo: string;

  @Column({ name: 'nomsexo', type: 'varchar', length: 9 })
  nomSexo: string;
}
