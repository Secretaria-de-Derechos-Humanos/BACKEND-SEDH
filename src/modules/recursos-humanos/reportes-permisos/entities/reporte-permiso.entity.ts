import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../../shared/database/base.entity';

export type TipoPermiso = 'vacaciones' | 'enfermedad' | 'personal' | 'maternidad' | 'paternidad' | 'otro';
export type EstadoPermiso = 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';

@Entity('reportes_permisos')
export class ReportePermiso extends BaseEntity {
  @Column({ name: 'empleado_id', length: 36 })
  empleadoId: string;

  @Column({ name: 'codigo_empleado', length: 20 })
  codigoEmpleado: string;

  @Column({ name: 'tipo_permiso', length: 50 })
  tipoPermiso: TipoPermiso;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin: Date;

  @Column({ name: 'total_dias' })
  totalDias: number;

  @Column({ length: 50, default: 'pendiente' })
  estado: EstadoPermiso;

  @Column({ nullable: true, length: 500 })
  motivo: string | null;

  @Column({ name: 'revisado_por', nullable: true, length: 36 })
  revisadoPor: string | null;

  @Column({ name: 'revisado_en', type: 'timestamptz', nullable: true })
  revisadoEn: Date | null;

  @Column({ name: 'notas_revision', nullable: true, length: 500 })
  notasRevision: string | null;
}
