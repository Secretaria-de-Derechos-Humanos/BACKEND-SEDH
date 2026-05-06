import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EntidadAuditoria } from '../../../../shared/database/base-audit.entity';
import { Cargo } from '../../catalogos/entities/cargo.entity';
import { TipoContratacion } from '../../catalogos/entities/tipo-contratacion.entity';
import { Sexo } from '../../catalogos/entities/sexo.entity';
import { EstadoCivil } from '../../catalogos/entities/estado-civil.entity';
import { Municipio } from '../../catalogos/entities/municipio.entity';

@Entity({ name: 'empleados', schema: 'rrhh' })
export class Empleado extends EntidadAuditoria {
  @PrimaryColumn({ name: 'emailinstitucional', type: 'varchar', length: 50 })
  emailInstitucional: string;

  @Column({ name: 'prinombre', type: 'varchar', length: 50 })
  priNombre: string;

  @Column({ name: 'segnombre', type: 'varchar', length: 50, nullable: true })
  segNombre: string | null;

  @Column({ name: 'priapellido', type: 'varchar', length: 50 })
  priApellido: string;

  @Column({ name: 'segapellido', type: 'varchar', length: 50, nullable: true })
  segApellido: string | null;

  @Column({ name: 'fecinglaborar', type: 'date' })
  fecIngLaboral: Date;

  @Column({ name: 'actlaboralmente', type: 'boolean', nullable: true, default: true })
  actLaboralmente: boolean | null;

  @Column({ name: 'numidentidad', type: 'varchar', length: 15 })
  numIdentidad: string;

  @Column({ name: 'numtelefono', type: 'varchar', length: 9, nullable: true })
  numTelefono: string | null;

  @Column({ name: 'idtipocontratacion', type: 'uuid' })
  idTipoContratacion: string;

  @Column({ name: 'idcargo', type: 'smallint' })
  idCargo: number;

  @Column({ name: 'idsupinmediato', type: 'varchar', length: 15, nullable: true })
  idSupInmediato: string | null;

  @Column({ name: 'idsexo', type: 'uuid' })
  idSexo: string;

  @Column({ name: 'idestadocivil', type: 'uuid' })
  idEstadoCivil: string;

  @Column({ name: 'idmunicipio', type: 'smallint', nullable: true })
  idMunicipio: number | null;

  @ManyToOne(() => Cargo, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'idcargo' })
  cargo: Cargo;

  @ManyToOne(() => TipoContratacion, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'idtipocontratacion' })
  tipoContratacion: TipoContratacion;

  @ManyToOne(() => Sexo, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'idsexo' })
  sexo: Sexo;

  @ManyToOne(() => EstadoCivil, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'idestadocivil' })
  estadoCivil: EstadoCivil;

  @ManyToOne(() => Municipio, { nullable: true })
  @JoinColumn({ name: 'idmunicipio' })
  municipio: Municipio | null;
}
