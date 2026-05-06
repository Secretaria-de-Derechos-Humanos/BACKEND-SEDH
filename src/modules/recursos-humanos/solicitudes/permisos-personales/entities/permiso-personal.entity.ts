import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EntidadAuditoria } from '../../../../../shared/database/base-audit.entity';
import { TipoSolicitudEmpleado } from '../../../catalogos/entities/tipo-solicitud-empleado.entity';
import { EstadoSolicitud } from '../../../catalogos/entities/estado-solicitud.entity';

@Entity({ name: 'permisos_personales', schema: 'rrhh' })
export class PermisoPersonal extends EntidadAuditoria {
  @PrimaryGeneratedColumn('uuid', { name: 'idpermisopersonal' })
  idPermisoPersonal: string;

  @Column({ name: 'idtiposolicitud', type: 'uuid' })
  idTipoSolicitud: string;

  @Column({ name: 'emailinstitucional', type: 'varchar', length: 50 })
  emailInstitucional: string;

  @Column({ name: 'fecsolicitud', type: 'date' })
  fecSolicitud: Date;

  @Column({ name: 'horsolicitadas', type: 'time', nullable: true })
  horSolicitadas: string | null;

  @Column({ name: 'idhorasdisponibles', type: 'smallint', nullable: true })
  idHorasDisponibles: number | null;

  @Column({ name: 'idestadosolicitud', type: 'uuid', nullable: true })
  idEstadoSolicitud: string | null;

  @Column({ name: 'motivo', type: 'varchar', length: 200 })
  motivo: string;

  @Column({ name: 'catemergencia', type: 'boolean', nullable: true, default: false })
  catEmergencia: boolean | null;

  @Column({ name: 'priaprobacion', type: 'varchar', length: 50, nullable: true })
  priAprobacion: string | null;

  @Column({ name: 'segaprobacion', type: 'varchar', length: 50, nullable: true })
  segAprobacion: string | null;

  @Column({ name: 'motrechazo', type: 'varchar', length: 100, nullable: true })
  motRechazo: string | null;

  @Column({ name: 'tiempolimite', type: 'time', nullable: true })
  tiempoLimite: string | null;

  @Column({ name: 'horsalida', type: 'time', nullable: true })
  horSalida: string | null;

  @Column({ name: 'horretorno', type: 'time', nullable: true })
  horRetorno: string | null;

  @Column({ name: 'guardiaturno', type: 'varchar', length: 50, nullable: true })
  guardiaTurno: string | null;

  @ManyToOne(() => TipoSolicitudEmpleado, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'idtiposolicitud' })
  tipoSolicitud: TipoSolicitudEmpleado;

  @ManyToOne(() => EstadoSolicitud, { nullable: true })
  @JoinColumn({ name: 'idestadosolicitud' })
  estadoSolicitud: EstadoSolicitud | null;
}
