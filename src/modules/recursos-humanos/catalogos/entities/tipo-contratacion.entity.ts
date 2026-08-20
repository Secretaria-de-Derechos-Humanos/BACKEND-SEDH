import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({
  name: 'tipos_contrataciones',
  schema: 'rrhh',
})
export class TipoContratacion {
  @PrimaryGeneratedColumn('uuid', {
    name: 'idtipocontratacion',
  })
  idTipoContratacion!: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 8,
  })
  nombre!: string;

  @Column({
    name: 'creadoen',
    type: 'date',
  })
  creadoEn!: Date;

  @Column({
    name: 'creadopor',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  creadoPor!: string | null;
}
