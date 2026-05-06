import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../../shared/database/base.entity';

export type EstadoAsistencia = 'presente' | 'ausente' | 'tardanza' | 'justificado';

@Entity('asistencias')
export class Asistencia extends BaseEntity {
  @Column({ name: 'empleado_id', length: 36 })
  empleadoId: string;

  @Column({ name: 'codigo_empleado', length: 20 })
  codigoEmpleado: string;

  @Column({ name: 'fecha_asistencia', type: 'date' })
  fechaAsistencia: Date;

  @Column({ name: 'hora_entrada', type: 'timetz', nullable: true })
  horaEntrada: Date | null;

  @Column({ name: 'hora_salida', type: 'timetz', nullable: true })
  horaSalida: Date | null;

  @Column({ length: 50 })
  estado: EstadoAsistencia;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
