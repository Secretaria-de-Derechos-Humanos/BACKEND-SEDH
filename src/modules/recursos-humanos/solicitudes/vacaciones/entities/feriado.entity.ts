import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({
  name: 'feriados',
  schema: 'rrhh',
})
export class Feriado {
  @PrimaryGeneratedColumn('uuid', {
    name: 'idferiado',
  })
  idFeriado!: string;

  @Column({
    name: 'fecha',
    type: 'date',
    unique: true,
  })
  fecha!: Date;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 150,
  })
  nombre!: string;

  @Column({
    name: 'descripcion',
    type: 'text',
    nullable: true,
  })
  descripcion!: string | null;

  @Column({
    name: 'activo',
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @Column({
    name: 'creadoen',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  creadoEn!: Date;

  @Column({
    name: 'creadopor',
    type: 'uuid',
    nullable: true,
  })
  creadoPor!: string | null;

  @Column({
    name: 'actualizadoen',
    type: 'timestamp',
    nullable: true,
  })
  actualizadoEn!: Date | null;

  @Column({
    name: 'actualizadopor',
    type: 'uuid',
    nullable: true,
  })
  actualizadoPor!: string | null;
}
