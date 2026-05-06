import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../../shared/database/base.entity';

export type TipoSolicitud = 'constancia' | 'certificado' | 'anticipo_sueldo' | 'documento' | 'otro';
export type EstadoSolicitud = 'pendiente' | 'en_proceso' | 'completado' | 'rechazado';

@Entity('solicitudes_empleados')
export class SolicitudEmpleado extends BaseEntity {
  @Column({ name: 'empleado_id', length: 36 })
  empleadoId: string;

  @Column({ name: 'codigo_empleado', length: 20 })
  codigoEmpleado: string;

  @Column({ name: 'tipo_solicitud', length: 50 })
  tipoSolicitud: TipoSolicitud;

  @Column({ length: 50, default: 'pendiente' })
  estado: EstadoSolicitud;

  @Column({ length: 500 })
  descripcion: string;

  @Column({ name: 'asignado_a', nullable: true, length: 36 })
  asignadoA: string | null;

  @Column({ name: 'resuelto_en', type: 'timestamptz', nullable: true })
  resueltoEn: Date | null;

  @Column({ name: 'notas_resolucion', nullable: true, length: 500 })
  notasResolucion: string | null;

  @Column({ type: 'jsonb', nullable: true })
  adjuntos: Record<string, unknown>[] | null;
}
