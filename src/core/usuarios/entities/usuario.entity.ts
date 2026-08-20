import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Rol } from '../../roles/entities/rol.entity';

@Entity({ name: 'usuarios', schema: 'core' })
export class Usuario {
  @PrimaryGeneratedColumn('uuid', { name: 'idusuario' })
  idUsuario!: string;

  @Column({ name: 'emailinstitucional', type: 'varchar', length: 50, unique: true })
  emailInstitucional!: string;

  @Column({
    name: 'prinombre',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  priNombre!: string | null;

  @Column({
    name: 'segnombre',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  segNombre!: string | null;

  @Column({
    name: 'priapellido',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  priApellido!: string | null;

  @Column({
    name: 'segapellido',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  segApellido!: string | null;
  @Exclude()
  @Column({ name: 'contrasena', type: 'text' })
  contrasena!: string;

  @Column({ name: 'activo', type: 'boolean', nullable: true, default: true })
  activo!: boolean | null;

  @Column({ name: 'ultimoacceso', type: 'timestamp', nullable: true })
  ultimoAcceso!: Date | null;

  @Column({ name: 'creadoen', type: 'date', nullable: true, default: () => 'CURRENT_DATE' })
  creadoEn!: Date | null;

  @Column({ name: 'creadopor', type: 'varchar', length: 50, nullable: true })
  creadoPor!: string | null;

  @Column({ name: 'actualizadoen', type: 'date', nullable: true })
  actualizadoEn!: Date | null;

  @Column({ name: 'actualizadopor', type: 'varchar', length: 50, nullable: true })
  actualizadoPor!: string | null;

  @Column({ name: 'debecambiarpassword', type: 'boolean', default: false })
  debeCambiarPassword!: boolean;

  @ManyToMany(() => Rol, { eager: true })
  @JoinTable({
    name: 'usuario_roles',
    schema: 'core',
    joinColumn: { name: 'idusuario', referencedColumnName: 'idUsuario' },
    inverseJoinColumn: { name: 'idrol', referencedColumnName: 'idRol' },
  })
  roles!: Rol[];
}
