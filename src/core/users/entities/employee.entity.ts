import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../shared/database/base.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('employees')
export class Employee extends BaseEntity {
  @Index()
  @Column({ name: 'employee_code', unique: true, length: 20 })
  employeeCode: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Index()
  @Column({ unique: true, length: 150 })
  email: string;

  @Exclude()
  @Column({ length: 255 })
  password: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'two_factor_enabled', default: false })
  twoFactorEnabled: boolean;

  @Exclude()
  @Column({ name: 'two_factor_secret', nullable: true, length: 500 })
  twoFactorSecret: string | null;

  @Exclude()
  @Column({ name: 'refresh_token_hash', nullable: true, length: 500 })
  refreshTokenHash: string | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @ManyToOne(() => Role, (role) => role.employees, {
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
