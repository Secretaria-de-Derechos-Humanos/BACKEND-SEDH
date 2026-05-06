import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1746489600000 implements MigrationInterface {
  name = 'InitialSchema1746489600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Roles ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"        VARCHAR(100) NOT NULL UNIQUE,
        "description" VARCHAR(255),
        "is_active"   BOOLEAN NOT NULL DEFAULT true,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"  TIMESTAMPTZ
      )
    `);

    // ── Permissions ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "module"      VARCHAR(100) NOT NULL,
        "sub_module"  VARCHAR(100),
        "action"      VARCHAR(50)  NOT NULL,
        "description" VARCHAR(255),
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"  TIMESTAMPTZ,
        UNIQUE ("module", "sub_module", "action")
      )
    `);

    // ── Role Permissions (junction) ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id"       UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "permission_id" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        PRIMARY KEY ("role_id", "permission_id")
      )
    `);

    // ── Employees ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_code"       VARCHAR(20)  NOT NULL UNIQUE,
        "first_name"          VARCHAR(100) NOT NULL,
        "last_name"           VARCHAR(100) NOT NULL,
        "email"               VARCHAR(150) NOT NULL UNIQUE,
        "password"            VARCHAR(255) NOT NULL,
        "is_active"           BOOLEAN NOT NULL DEFAULT true,
        "two_factor_enabled"  BOOLEAN NOT NULL DEFAULT false,
        "two_factor_secret"   VARCHAR(500),
        "refresh_token_hash"  VARCHAR(500),
        "last_login_at"       TIMESTAMPTZ,
        "role_id"             UUID NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"          TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_employees_email" ON "employees" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_employees_code"  ON "employees" ("employee_code")`);

    // ── Audit Logs ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id"    VARCHAR(36),
        "employee_email" VARCHAR(150),
        "action"         VARCHAR(50)  NOT NULL,
        "resource"       VARCHAR(100) NOT NULL,
        "resource_id"    VARCHAR(36),
        "ip_address"     VARCHAR(45),
        "user_agent"     VARCHAR(500),
        "metadata"       JSONB,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"     TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_employee_id" ON "audit_logs" ("employee_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_action"      ON "audit_logs" ("action")`);

    // ── RR.HH: Asistencias ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "asistencias" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "empleado_id"      VARCHAR(36)  NOT NULL,
        "codigo_empleado"  VARCHAR(20)  NOT NULL,
        "fecha_asistencia" DATE         NOT NULL,
        "hora_entrada"     TIMETZ,
        "hora_salida"      TIMETZ,
        "estado"           VARCHAR(50)  NOT NULL,
        "metadata"         JSONB,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"       TIMESTAMPTZ
      )
    `);

    // ── RR.HH: Reportes de Permisos ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "reportes_permisos" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "empleado_id"      VARCHAR(36)  NOT NULL,
        "codigo_empleado"  VARCHAR(20)  NOT NULL,
        "tipo_permiso"     VARCHAR(50)  NOT NULL,
        "fecha_inicio"     DATE         NOT NULL,
        "fecha_fin"        DATE         NOT NULL,
        "total_dias"       INTEGER      NOT NULL,
        "estado"           VARCHAR(50)  NOT NULL DEFAULT 'pendiente',
        "motivo"           VARCHAR(500),
        "revisado_por"     VARCHAR(36),
        "revisado_en"      TIMESTAMPTZ,
        "notas_revision"   VARCHAR(500),
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"       TIMESTAMPTZ
      )
    `);

    // ── RR.HH: Solicitudes de Empleados ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "solicitudes_empleados" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "empleado_id"       VARCHAR(36)  NOT NULL,
        "codigo_empleado"   VARCHAR(20)  NOT NULL,
        "tipo_solicitud"    VARCHAR(50)  NOT NULL,
        "estado"            VARCHAR(50)  NOT NULL DEFAULT 'pendiente',
        "descripcion"       VARCHAR(500) NOT NULL,
        "asignado_a"        VARCHAR(36),
        "resuelto_en"       TIMESTAMPTZ,
        "notas_resolucion"  VARCHAR(500),
        "adjuntos"          JSONB,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at"        TIMESTAMPTZ
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "solicitudes_empleados"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reportes_permisos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asistencias"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employees"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
  }
}
