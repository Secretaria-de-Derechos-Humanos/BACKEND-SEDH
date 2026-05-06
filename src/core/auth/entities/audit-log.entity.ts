import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

export type AuditAction = 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'ACCESS' | 'PERMISSION_CHANGE';

@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  @Index()
  @Column({ name: 'employee_id', nullable: true, length: 36 })
  employeeId: string | null;

  @Column({ name: 'employee_email', nullable: true, length: 150 })
  employeeEmail: string | null;

  @Index()
  @Column({ length: 50 })
  action: AuditAction;

  @Column({ length: 100 })
  resource: string;

  @Column({ name: 'resource_id', nullable: true, length: 36 })
  resourceId: string | null;

  @Column({ name: 'ip_address', nullable: true, length: 45 })
  ipAddress: string | null;

  @Column({ name: 'user_agent', nullable: true, length: 500 })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
