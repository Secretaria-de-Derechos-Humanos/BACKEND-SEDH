import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

import { Constancia } from './constancia.entity';

@Entity({ name: 'constancias_finalidades', schema: 'rrhh' })
export class ConstanciaFinalidad {
  @PrimaryGeneratedColumn('uuid', { name: 'idconstanciafinalidad' })
  idConstanciaFinalidad!: string;

  @Column({ name: 'idconstancia', type: 'uuid' })
  idConstancia!: string;

  @Column({
    name: 'finalidad',
    type: 'varchar',
    length: 150,
  })
  finalidad!: string;

  @ManyToOne(() => Constancia, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'idconstancia' })
  constancia!: Constancia;
}
