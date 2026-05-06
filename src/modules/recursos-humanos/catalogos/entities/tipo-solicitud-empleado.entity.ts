import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'tipos_solicitudes_empleados', schema: 'rrhh' })
export class TipoSolicitudEmpleado {
  @PrimaryGeneratedColumn('uuid', { name: 'idtiposolicitud' })
  idTipoSolicitud: string;

  @Column({ name: 'nomtipo', type: 'varchar', length: 25, nullable: true })
  nomTipo: string | null;
}
