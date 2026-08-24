import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({
  name: 'historial_vacaciones',
  schema: 'rrhh',
})
export class HistorialVacaciones {
  @PrimaryGeneratedColumn('uuid', {
    name: 'idhistorial',
  })
  idHistorial!: string;

  @Column({
    name: 'idpermisovaca',
    type: 'uuid',
    nullable: true,
  })
  idPermisoVaca!: string | null;

  @Column({
    name: 'idsaldovacacion',
    type: 'uuid',
    nullable: true,
  })
  idSaldoVacacion!: string | null;

  @Column({
    name: 'idusuarioaccion',
    type: 'uuid',
  })
  idUsuarioAccion!: string;

  @Column({
    name: 'accion',
    type: 'varchar',
    length: 50,
  })
  accion!: string;

  @Column({
    name: 'estadoanterior',
    type: 'uuid',
    nullable: true,
  })
  estadoAnterior!: string | null;

  @Column({
    name: 'estadonuevo',
    type: 'uuid',
    nullable: true,
  })
  estadoNuevo!: string | null;

  @Column({
    name: 'observacion',
    type: 'text',
    nullable: true,
  })
  observacion!: string | null;

  @Column({
    name: 'fechaaccion',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaAccion!: Date;
}
