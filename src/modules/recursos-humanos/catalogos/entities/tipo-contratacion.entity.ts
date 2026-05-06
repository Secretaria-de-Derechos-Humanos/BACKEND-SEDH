import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { EntidadAuditoria } from '../../../../shared/database/base-audit.entity';

@Entity({ name: 'tipos_contrataciones', schema: 'rrhh' })
export class TipoContratacion extends EntidadAuditoria {
  @PrimaryGeneratedColumn('uuid', { name: 'idtipocontratacion' })
  idTipoContratacion: string;

  @Column({ name: 'nombre', type: 'varchar', length: 8 })
  nombre: string;
}
