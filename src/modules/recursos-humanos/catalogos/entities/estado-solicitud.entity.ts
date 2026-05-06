import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'estados_solicitudes', schema: 'rrhh' })
export class EstadoSolicitud {
  @PrimaryGeneratedColumn('uuid', { name: 'idestadosolicitud' })
  idEstadoSolicitud: string;

  @Column({ name: 'nomestado', type: 'varchar', length: 10, nullable: true })
  nomEstado: string | null;
}
