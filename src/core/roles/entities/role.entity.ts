import { Entity, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';
import { Permission } from '../../permissions/entities/permission.entity';
import { Employee } from '../../users/entities/employee.entity';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ nullable: true, length: 255 })
  description: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToMany(() => Permission, (permission) => permission.roles, {
    eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @OneToMany(() => Employee, (employee) => employee.role)
  employees: Employee[];
}
