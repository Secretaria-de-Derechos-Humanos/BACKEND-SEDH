import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EntidadAuditoria } from '../../../../shared/database/base-audit.entity';
import { EstadoSolicitud } from '../../catalogos/entities/estado-solicitud.entity';

@Entity({ name: 'constancias', schema: 'rrhh' })
export class Constancia extends EntidadAuditoria {
  @PrimaryGeneratedColumn('uuid', { name: 'idconstancia' })
  idConstancia!: string;

  @Column({ name: 'idusuario', type: 'uuid' })
  idUsuario!: string;

  @Column({ name: 'emailinstitucional', type: 'varchar', length: 50 })
  emailInstitucional!: string;

  @Column({ name: 'fecsolicitud', type: 'date' })
  fecSolicitud!: Date;

  @Column({
    name: 'modalidadsalario',
    type: 'varchar',
    length: 30,
  })
  modalidadSalario!: string;

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observaciones!: string | null;

  @Column({
    name: 'idestadosolicitud',
    type: 'uuid',
    nullable: true,
  })
  idEstadoSolicitud!: string | null;

  @Column({
    name: 'motrechazo',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  motRechazo!: string | null;

  @Column({
    name: 'nombrearchivo',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nombreArchivo!: string | null;

  @Column({
    name: 'rutaarchivo',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rutaArchivo!: string | null;

  @Column({
    name: 'tipoarchivo',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tipoArchivo!: string | null;

  @Column({
    name: 'fechageneracion',
    type: 'timestamp',
    nullable: true,
  })
  fechaGeneracion!: Date | null;

  @Column({
    name: 'generadopor',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  generadoPor!: string | null;

  @Column({
    name: 'fecharecepcion',
    type: 'timestamp',
    nullable: true,
  })
  fechaRecepcion!: Date | null;

  @Column({
    name: 'recibidopor',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  recibidoPor!: string | null;

  @ManyToOne(() => EstadoSolicitud, { nullable: true })
  @JoinColumn({ name: 'idestadosolicitud' })
  estadoSolicitud!: EstadoSolicitud | null;
}
