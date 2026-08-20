import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({
  name: 'vacaciones_saldos',
  schema: 'rrhh',
})
export class VacacionesSaldo {
  @PrimaryGeneratedColumn('uuid', {
    name: 'idsaldovacacion',
  })
  idSaldoVacacion!: string;

  @Column({
    name: 'idusuario',
    type: 'uuid',
  })
  idUsuario!: string;

  @Column({
    name: 'anio',
    type: 'integer',
  })
  anio!: number;

  @Column({
    name: 'diasasignados',
    type: 'smallint',
    default: 0,
  })
  diasAsignados!: number;

  @Column({
    name: 'diasutilizados',
    type: 'smallint',
    default: 0,
  })
  diasUtilizados!: number;

  @Column({
    name: 'diasreservados',
    type: 'smallint',
    default: 0,
  })
  diasReservados!: number;

  @Column({
    name: 'observacion',
    type: 'text',
    nullable: true,
  })
  observacion!: string | null;

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
