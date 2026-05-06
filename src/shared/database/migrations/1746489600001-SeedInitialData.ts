import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Seed inicial:
 * - Permisos del sistema
 * - Roles base (Admin, Subgerente RRHH, Empleado)
 * - Empleado administrador inicial
 *
 * IMPORTANTE: Cambiar la contraseña del admin en el primer inicio.
 */
export class SeedInitialData1746489600001 implements MigrationInterface {
  name = 'SeedInitialData1746489600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Permisos ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "permissions" ("module", "sub_module", "action", "description") VALUES
        -- Core: Empleados
        ('core', 'employees', 'read',   'Ver listado de empleados'),
        ('core', 'employees', 'create', 'Crear empleados'),
        ('core', 'employees', 'update', 'Editar empleados'),
        ('core', 'employees', 'delete', 'Eliminar empleados'),
        -- Core: Roles
        ('core', 'roles', 'read',   'Ver roles'),
        ('core', 'roles', 'create', 'Crear roles'),
        ('core', 'roles', 'update', 'Editar roles'),
        ('core', 'roles', 'delete', 'Eliminar roles'),
        -- Core: Permisos
        ('core', 'permissions', 'read',   'Ver permisos'),
        ('core', 'permissions', 'create', 'Crear permisos'),
        ('core', 'permissions', 'delete', 'Eliminar permisos'),
        -- RRHH: Asistencias
        ('recursos-humanos', 'asistencias', 'read',   'Ver asistencias'),
        ('recursos-humanos', 'asistencias', 'create', 'Registrar asistencia'),
        ('recursos-humanos', 'asistencias', 'update', 'Editar asistencia'),
        ('recursos-humanos', 'asistencias', 'delete', 'Eliminar asistencia'),
        -- RRHH: Reportes de permisos
        ('recursos-humanos', 'reportes-permisos', 'read',   'Ver reportes de permisos'),
        ('recursos-humanos', 'reportes-permisos', 'create', 'Crear reporte de permiso'),
        ('recursos-humanos', 'reportes-permisos', 'update', 'Revisar reporte de permiso'),
        ('recursos-humanos', 'reportes-permisos', 'delete', 'Eliminar reporte de permiso'),
        -- RRHH: Solicitudes
        ('recursos-humanos', 'solicitudes', 'read',   'Ver solicitudes'),
        ('recursos-humanos', 'solicitudes', 'create', 'Crear solicitud'),
        ('recursos-humanos', 'solicitudes', 'update', 'Actualizar solicitud'),
        ('recursos-humanos', 'solicitudes', 'delete', 'Eliminar solicitud')
    `);

    // ── Roles ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "roles" ("id", "name", "description") VALUES
        ('11111111-0000-0000-0000-000000000001', 'Administrador',            'Acceso total al sistema'),
        ('11111111-0000-0000-0000-000000000002', 'Subgerente de RRHH',       'Acceso a módulo de recursos humanos'),
        ('11111111-0000-0000-0000-000000000003', 'Empleado',                 'Acceso básico para solicitudes propias')
    `);

    // Admin: todos los permisos
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT '11111111-0000-0000-0000-000000000001', id FROM "permissions"
    `);

    // Subgerente RRHH: todos los permisos de recursos-humanos
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT '11111111-0000-0000-0000-000000000002', id FROM "permissions"
      WHERE "module" = 'recursos-humanos'
    `);

    // Empleado: solo crear y leer sus propias solicitudes
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id")
      SELECT '11111111-0000-0000-0000-000000000003', id FROM "permissions"
      WHERE "module" = 'recursos-humanos'
        AND "sub_module" = 'solicitudes'
        AND "action" IN ('read', 'create')
    `);

    // ── Empleado Admin inicial ────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('Admin@SEDH2026!', 12);
    await queryRunner.query(`
      INSERT INTO "employees"
        ("id", "employee_code", "first_name", "last_name", "email", "password", "role_id")
      VALUES
        (
          '22222222-0000-0000-0000-000000000001',
          'ADMIN-001',
          'Administrador',
          'Sistema',
          'admin@sedh.gob',
          '${passwordHash}',
          '11111111-0000-0000-0000-000000000001'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "employees" WHERE "employee_code" = 'ADMIN-001'`);
    await queryRunner.query(`DELETE FROM "role_permissions"`);
    await queryRunner.query(`DELETE FROM "roles"`);
    await queryRunner.query(`DELETE FROM "permissions"`);
  }
}
