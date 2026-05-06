import { Entity, Column, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';
import { Role } from '../../roles/entities/role.entity';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'manage';

@Entity('permissions')
export class Permission extends BaseEntity {
  @Column({ length: 100 })
  module: string;

  @Column({ name: 'sub_module', nullable: true, length: 100 })
  subModule: string | null;

  @Column({ length: 50 })
  action: PermissionAction;

  @Column({ nullable: true, length: 255 })
  description: string | null;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
