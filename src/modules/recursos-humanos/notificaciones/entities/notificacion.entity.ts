import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity({
  name: 'notificaciones',
  schema: 'rrhh',
})
export class Notificacion {
  @PrimaryGeneratedColumn('uuid', {
    name: 'idnotificacion',
  })
  idNotificacion!: string;

  @Index()
  @Column({
    name: 'idusuario',
    type: 'uuid',
  })
  idUsuario!: string;

  @Column({
    name: 'titulo',
    type: 'varchar',
    length: 150,
  })
  titulo!: string;

  @Column({
    name: 'mensaje',
    type: 'varchar',
    length: 500,
  })
  mensaje!: string;

  @Column({
    name: 'tipo',
    type: 'varchar',
    length: 50,
  })
  tipo!: string;

  @Column({
    name: 'idsolicitud',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  idSolicitud!: string | null;

  @Index()
  @Column({
    name: 'leida',
    type: 'boolean',
    default: false,
  })
  leida!: boolean;

  @Index()
  @Column({
    name: 'fechacreacion',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion!: Date;
}
