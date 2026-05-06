import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EntidadAuditoria } from '../../../../../shared/database/base-audit.entity';
import { TipoSolicitudEmpleado } from '../../../catalogos/entities/tipo-solicitud-empleado.entity';
import { EstadoSolicitud } from '../../../catalogos/entities/estado-solicitud.entity';
import { Cargo } from '../../../catalogos/entities/cargo.entity';
import { TipoContratacion } from '../../../catalogos/entities/tipo-contratacion.entity';

@Entity({ name: 'vacaciones', schema: 'rrhh' })
export class Vacacion extends EntidadAuditoria {
  @PrimaryGeneratedColumn('uuid', { name: 'idpermisovaca' })
  idPermisoVaca: string;

  @Column({ name: 'idtiposolicitud', type: 'uuid' })
  idTipoSolicitud: string;

  @Column({ name: 'emailinstitucional', type: 'varchar', length: 50 })
  emailInstitucional: string;

  @Column({ name: 'fecsolicitud', type: 'date' })
  fecSolicitud: Date;

  @Column({ name: 'idestadosolicitud', type: 'uuid', nullable: true })
  idEstadoSolicitud: string | null;

  @Column({ name: 'idcargo', type: 'smallint' })
  idCargo: number;

  @Column({ name: 'idtipocontratacion', type: 'uuid', nullable: true })
  idTipoContratacion: string | null;

  @Column({ name: 'cantvacaciones', type: 'smallint' })
  cantVacaciones: number;

  @Column({ name: 'fecinicial', type: 'date' })
  fecInicial: Date;

  @Column({ name: 'fecfinal', type: 'date' })
  fecFinal: Date;

  @Column({ name: 'fecretorno', type: 'date', nullable: true })
  fecRetorno: Date | null;

  @Column({ name: 'peranterior', type: 'varchar', length: 11, nullable: true, default: 'NO APLICA' })
  perAnterior: string | null;

  @Column({ name: 'cantperanterior', type: 'smallint', nullable: true, default: 0 })
  cantPerAnterior: number | null;

  @Column({ name: 'peractual', type: 'varchar', length: 11, nullable: true })
  perActual: string | null;

  @Column({ name: 'cantperactual', type: 'smallint', nullable: true })
  cantPerActual: number | null;

  @Column({ name: 'totdiasperiodos', type: 'smallint', nullable: true })
  totDiasPeriodos: number | null;

  @Column({ name: 'totdiasrestantes', type: 'smallint', nullable: true })
  totDiasRestantes: number | null;

  @Column({ name: 'observaciones', type: 'varchar', length: 200, nullable: true })
  observaciones: string | null;

  @Column({ name: 'priaprobacion', type: 'varchar', length: 50, nullable: true })
  priAprobacion: string | null;

  @Column({ name: 'segaprobacion', type: 'varchar', length: 50, nullable: true })
  segAprobacion: string | null;

  @Column({ name: 'motrechazo', type: 'varchar', length: 100, nullable: true })
  motRechazo: string | null;

  @ManyToOne(() => TipoSolicitudEmpleado, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'idtiposolicitud' })
  tipoSolicitud: TipoSolicitudEmpleado;

  @ManyToOne(() => EstadoSolicitud, { nullable: true })
  @JoinColumn({ name: 'idestadosolicitud' })
  estadoSolicitud: EstadoSolicitud | null;

  @ManyToOne(() => Cargo, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'idcargo' })
  cargo: Cargo;

  @ManyToOne(() => TipoContratacion, { nullable: true })
  @JoinColumn({ name: 'idtipocontratacion' })
  tipoContratacion: TipoContratacion | null;
}
