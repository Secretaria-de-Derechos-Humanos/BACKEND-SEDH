import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Departamento } from './departamento.entity';

@Entity({ name: 'municipios', schema: 'rrhh' })
export class Municipio {
  @PrimaryColumn({ name: 'idmunicipio', type: 'smallint' })
  idMunicipio: number;

  @Column({ name: 'nommunicipio', type: 'varchar', length: 50 })
  nomMunicipio: string;

  @Column({ name: 'iddepartamento', type: 'smallint' })
  idDepartamento: number;

  @ManyToOne(() => Departamento)
  @JoinColumn({ name: 'iddepartamento' })
  departamento: Departamento;
}
