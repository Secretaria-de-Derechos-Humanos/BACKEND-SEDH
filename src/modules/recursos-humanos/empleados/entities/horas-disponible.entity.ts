import { Entity, PrimaryColumn, Column } from 'typeorm';
import { EntidadAuditoria } from '../../../../shared/database/base-audit.entity';

@Entity({ name: 'horas_disponibles', schema: 'rrhh' })
export class HorasDisponible extends EntidadAuditoria {
  @PrimaryColumn({ name: 'idhorasdisponible', type: 'smallint' })
  idHorasDisponible: number;

  @Column({ name: 'emailinstitucional', type: 'varchar', length: 50 })
  emailInstitucional: string;

  @Column({ name: 'hordisponibles', type: 'time', nullable: true })
  horDisponibles: string | null;
}
