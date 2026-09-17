"use strict";

const mssql = require("mssql");
const pg = require("pg");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

dotenv.config({
  path: path.resolve(process.cwd(), ".env.migracion"),
});

/*
 * ============================================================
 * MIGRACIÓN INCREMENTAL - SOLO FALTANTES
 * SQL SERVER -> POSTGRESQL
 * ============================================================
 *
 * FECHA DE CORTE:
 *   2026-08-12
 *
 * SE PROCESA:
 *   - EMPLEADOS nuevos
 *   - PERMISOS_PERSONALES nuevos
 *   - PERMISOS_OFICIALES nuevos
 *
 * NO SE PROCESA:
 *   - Vacaciones
 *   - Permisos de estudios
 *   - Actualizaciones de registros existentes
 *   - Eliminaciones
 *   - Historial de cargos
 *
 * PRIMERA EJECUCIÓN:
 *   DRY_RUN=true
 *
 * ============================================================
 */

const FECHA_CORTE = "2026-08-13";

const DRY_RUN =
  String(process.env.DRY_RUN ?? "true").toLowerCase() === "true";

const MIGRACION_CREADOR = (
  process.env.MIGRACION_CREADOR ??
  "MIGRACION_INCREMENTAL"
).trim();

/*
 * ============================================================
 * CONFIGURACIÓN SQL SERVER
 * ============================================================
 */

const SQL_CONFIG = {
  user: process.env.SQL_USER ?? "",
  password: process.env.SQL_PASSWORD ?? "",
  server: process.env.SQL_HOST ?? "",
  port: Number(process.env.SQL_PORT ?? 1433),
  database: process.env.SQL_DATABASE ?? "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

/*
 * ============================================================
 * CONFIGURACIÓN POSTGRESQL
 * ============================================================
 */

const PG_CONFIG = {
  host: process.env.PG_HOST ?? "",
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER ?? "",
  password: process.env.PG_PASSWORD ?? "",
  database: process.env.PG_DATABASE ?? "",
  max: 5,
  idleTimeoutMillis: 30000,
};

/*
 * ============================================================
 * FUNCIONES AUXILIARES
 * ============================================================
 */

function text(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function email(v) {
  return String(v ?? "")
    .normalize("NFKC")
    .replace(
      /[\u0000-\u001F\u007F\u00A0\u200B-\u200D\uFEFF]/g,
      "",
    )
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function identidad(v) {
  return String(v ?? "")
    .trim()
    .replace(/[^\dA-Za-z]/g, "")
    .toUpperCase();
}

function nullable(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function bool(v) {
  if (typeof v === "boolean") {
    return v;
  }

  if (typeof v === "number") {
    return v !== 0;
  }

  return ["1", "true", "si"].includes(
    String(v ?? "").trim().toLowerCase(),
  );
}

function dateOnly(v) {
  if (!v) {
    return null;
  }

  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(
      v.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(v.getUTCDate()).padStart(
      2,
      "0",
    )}`;
  }

  return String(v).slice(0, 10);
}

function timeText(v) {
  if (v == null) {
    return null;
  }

  if (v instanceof Date) {
    return `${String(v.getUTCHours()).padStart(
      2,
      "0",
    )}:${String(v.getUTCMinutes()).padStart(
      2,
      "0",
    )}:${String(v.getUTCSeconds()).padStart(
      2,
      "0",
    )}`;
  }

  const s = String(v).trim();

  const m = s.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?/,
  );

  return m
    ? `${String(Number(m[1])).padStart(
        2,
        "0",
      )}:${m[2]}:${m[3] ?? "00"}`
    : s || null;
}

function rolesKey(roles) {
  const out = [];

  for (const v of roles) {
    if (!out.includes(v)) {
      out.push(v);
    }
  }

  return out.sort((a, b) => a - b);
}

/*
 * ============================================================
 * EX-EMPLEADOS EXCLUIDOS
 * ============================================================
 */

const EMAILS_EX_EMPLEADOS_EXCLUIDOS = new Set([
  "maria.matute@sedh.gob.hn",
  "roy.santos@sedh.gob.hn",
  "ernesto.manzanarez@sedh.gob.hn",
]);

function esExEmpleadoExcluido(valor) {
  return EMAILS_EX_EMPLEADOS_EXCLUIDOS.has(
    email(valor),
  );
}

/*
 * ============================================================
 * MAPEO DE CARGOS YA UTILIZADO EN LA MIGRACIÓN ANTERIOR
 * ============================================================
 */

const MAPEO_CARGOS_SQL_PG = new Map([
  [139, 140],
  [140, 141],
  [141, 142],
  [142, 143],
  [143, 144],
  [144, 145],
  [145, 146],

  [146, 147],
  [148, 148],
  [149, 149],
  [150, 150],
  [151, 151],
  [152, 152],
  [155, 153],
  [156, 154],
]);

/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main() {
  console.log("");
  console.log(
    "============================================================",
  );
  console.log(
    "     MIGRACIÓN INCREMENTAL SQL SERVER -> POSTGRESQL",
  );
  console.log(
    "                 SOLO REGISTROS FALTANTES",
  );
  console.log(
    "============================================================",
  );

  console.log(`FECHA DE CORTE: ${FECHA_CORTE}`);

  console.log(
    `DRY_RUN: ${
      DRY_RUN
        ? "ACTIVADO - NO SE MODIFICA POSTGRESQL"
        : "DESACTIVADO - MIGRACIÓN REAL"
    }`,
  );

  console.log("");
  console.log("SE PROCESARÁ:");
  console.log("  ✓ Empleados nuevos");
  console.log("  ✓ Permisos personales nuevos");
  console.log("  ✓ Permisos oficiales nuevos");

  console.log("");
  console.log("NO SE PROCESARÁ:");
  console.log("  ✗ Vacaciones");
  console.log("  ✗ Permisos de estudios");
  console.log("  ✗ Actualizaciones");
  console.log("  ✗ Eliminaciones");
  console.log("  ✗ Historial de cargos");
  console.log("");

  let sqlPool = null;

  const pgPool = new pg.Pool(PG_CONFIG);

  try {
    /*
     * ========================================================
     * CONEXIONES
     * ========================================================
     */

    console.log("Conectando a SQL Server...");

    sqlPool = await mssql.connect(SQL_CONFIG);

    console.log("✅ SQL Server conectado");

    console.log("Conectando a PostgreSQL...");

    await pgPool.query("SELECT 1");

    console.log("✅ PostgreSQL conectado");

    /*
     * ========================================================
     * CARGAR DATOS SQL SERVER
     * ========================================================
     */

    console.log("");
    console.log(
      "Cargando información desde SQL Server...",
    );

    const [
      empleadosR,
      empleadosRolesR,
      rolesR,
      tiposContratacionR,
      sexosR,
      estadosCivilesR,
      departamentosR,
      municipiosR,
      dependenciasR,
      cargosR,
      tiposSolicitudR,
      estadosSolicitudR,
      horasR,
      personalesR,
      oficialesR,
    ] = await Promise.all([
      /*
       * EMPLEADOS:
       * únicamente creados después de la fecha de corte.
       */
      sqlPool.request().query(`
        SELECT
          EmailInstitucional AS emailinstitucional,
          PriNombre AS prinombre,
          SegNombre AS segnombre,
          PriApellido AS priapellido,
          SegApellido AS segapellido,
          FecIngLaborar AS fecinglaborar,
          ActLaboralmente AS actlaboralmente,
          NumIdentidad AS numidentidad,
          NumTelefono AS numtelefono,
          IdTipoContratacion AS idtipocontratacion,
          IdCargo AS idcargo,
          IdSupInmediato AS idsupinmediato,
          IdSexo AS idsexo,
          IdEstadoCivil AS idestadocivil,
          IdMunicipio AS idmunicipio,
          CreadoEn AS creadoen,
          CreadoPor AS creadopor,
          ActualizadoEn AS actualizadoen,
          ActualizadoPor AS actualizadopor
        FROM dbo.EMPLEADOS
        WHERE CreadoEn >= '${FECHA_CORTE}'
          AND LOWER(LTRIM(RTRIM(EmailInstitucional))) NOT IN (
            'roy.santos@sedh.gob.hn',
            'ernesto.manzanarez@sedh.gob.hn',
            'maria.matute@sedh.gob.hn'
          )
      `),

      /*
       * ROLES DE EMPLEADOS
       */
      sqlPool.request().query(`
        SELECT
          EmailInstitucional AS emailinstitucional,
          IdRol AS idrol,
          Contrasena AS contrasena,
          Activo AS activo
        FROM dbo.EMPLEADOS_ROLES
      `),

      /*
       * ROLES
       */
      sqlPool.request().query(`
        SELECT
          IdRol AS id,
          NomRol AS nombre
        FROM dbo.ROLES
        ORDER BY IdRol
      `),

      /*
       * TIPOS CONTRATACIÓN
       */
      sqlPool.request().query(`
        SELECT
          IdTipoContratacion AS id,
          Nombre AS nombre
        FROM dbo.TIPOS_CONTRATACIONES
      `),

      /*
       * SEXOS
       */
      sqlPool.request().query(`
        SELECT
          IdSexo AS id,
          NomSexo AS nombre
        FROM dbo.SEXOS
      `),

      /*
       * ESTADOS CIVILES
       */
      sqlPool.request().query(`
        SELECT
          IdEstadoCivil AS id,
          NomEstadoCivil AS nombre
        FROM dbo.ESTADOS_CIVILES
      `),

      /*
       * DEPARTAMENTOS
       */
      sqlPool.request().query(`
        SELECT
          IdDepartamento AS id,
          NomDepartamento AS nombre
        FROM dbo.DEPARTAMENTOS
      `),

      /*
       * MUNICIPIOS
       */
      sqlPool.request().query(`
        SELECT
          IdMunicipio AS id,
          NomMunicipio AS nombre,
          IdDepartamento AS iddepartamento
        FROM dbo.MUNICIPIOS
      `),

      /*
       * DEPENDENCIAS
       */
      sqlPool.request().query(`
        SELECT
          IdDependencia AS id,
          NomDependencia AS nombre
        FROM dbo.DEPENDENCIAS
      `),

      /*
       * CARGOS
       */
      sqlPool.request().query(`
        SELECT
          IdCargo AS id,
          NomCargo AS nombre,
          IdDependencia AS iddependencia
        FROM dbo.CARGOS
      `),

      /*
       * TIPOS DE SOLICITUD
       */
      sqlPool.request().query(`
        SELECT
          IdTipoSolicitud AS id,
          NomTipo AS nombre
        FROM dbo.TIPOS_SOLICITUDES
      `),

      /*
       * ESTADOS DE SOLICITUD
       */
      sqlPool.request().query(`
        SELECT
          IdEstadoSolicitud AS id,
          NomEstado AS nombre
        FROM dbo.ESTADOS_SOLICITUDES
      `),

      /*
       * HORAS DISPONIBLES
       *
       * Se cargan para poder resolver los permisos nuevos.
       * NO se migran todas.
       */
      sqlPool.request().query(`
        SELECT
          IdHorasDisponible AS idhorasdisponible,
          EmailInstitucional AS emailinstitucional,
          HorDisponibles AS hordisponibles,
          CreadoEn AS creadoen,
          CreadoPor AS creadopor,
          ActualizadoEn AS actualizadoen,
          ActualizadoPor AS actualizadopor
        FROM dbo.HORAS_DISPONIBLES
        WHERE LOWER(LTRIM(RTRIM(EmailInstitucional))) NOT IN (
          'roy.santos@sedh.gob.hn',
          'ernesto.manzanarez@sedh.gob.hn',
          'maria.matute@sedh.gob.hn'
        )
      `),

      /*
       * PERMISOS PERSONALES:
       * únicamente desde la fecha de corte.
       */
      sqlPool.request().query(`
        SELECT
          IdPermisoPersonal AS idpermisopersonal,
          IdTipoSolicitud AS idtiposolicitud,
          EmailInstitucional AS emailinstitucional,
          FecSolicitud AS fecsolicitud,
          HorSolicitadas AS horsolicitadas,
          IdHorasDisponibles AS idhorasdisponibles,
          IdEstadoSolicitud AS idestadosolicitud,
          Motivo AS motivo,
          CatEmergencia AS catemergencia,
          PriAprobacion AS priaprobacion,
          SegAprobacion AS segaprobacion,
          MotRechazo AS motrechazo,
          TiempoLimite AS tiempolimite,
          HorSalida AS horsalida,
          HorRetorno AS horretorno,
          GuardiaTurno AS guardiaturno,
          CreadoEn AS creadoen,
          CreadoPor AS creadopor,
          ActualizadoEn AS actualizadoen,
          ActualizadoPor AS actualizadopor
        FROM dbo.PERMISOS_PERSONALES
        WHERE FecSolicitud >= '${FECHA_CORTE}'
          AND LOWER(LTRIM(RTRIM(EmailInstitucional))) NOT IN (
            'roy.santos@sedh.gob.hn',
            'ernesto.manzanarez@sedh.gob.hn',
            'maria.matute@sedh.gob.hn'
          )
      `),

      /*
       * PERMISOS OFICIALES:
       * únicamente desde la fecha de corte.
       */
      sqlPool.request().query(`
        SELECT
          IdPermisoOficial AS idpermisooficial,
          IdTipoSolicitud AS idtiposolicitud,
          EmailInstitucional AS emailinstitucional,
          FecSolicitud AS fecsolicitud,
          IdEstadoSolicitud AS idestadosolicitud,
          Motivo AS motivo,
          PriAprobacion AS priaprobacion,
          SegAprobacion AS segaprobacion,
          MotRechazo AS motrechazo,
          TiempoLimite AS tiempolimite,
          HorSalida AS horsalida,
          HorRetorno AS horretorno,
          GuardiaTurno AS guardiaturno,
          CreadoEn AS creadoen,
          CreadoPor AS creadopor,
          ActualizadoEn AS actualizadoen,
          ActualizadoPor AS actualizadoPor
        FROM dbo.PERMISOS_OFICIALES
        WHERE FecSolicitud >= '${FECHA_CORTE}'
          AND LOWER(LTRIM(RTRIM(EmailInstitucional))) NOT IN (
            'roy.santos@sedh.gob.hn',
            'ernesto.manzanarez@sedh.gob.hn',
            'maria.matute@sedh.gob.hn'
          )
      `),
    ]);

    const empleados = empleadosR.recordset;
    const empleadosRoles = empleadosRolesR.recordset;
    const rolesSql = rolesR.recordset;
    const tiposContratacionSql =
      tiposContratacionR.recordset;
    const sexosSql = sexosR.recordset;
    const estadosCivilesSql =
      estadosCivilesR.recordset;
    const departamentosSql =
      departamentosR.recordset;
    const municipiosSql = municipiosR.recordset;
    const dependenciasSql =
      dependenciasR.recordset;
    const cargosSql = cargosR.recordset;
    const tiposSolicitudSql =
      tiposSolicitudR.recordset;
    const estadosSolicitudSql =
      estadosSolicitudR.recordset;
    const horasSql = horasR.recordset;
    const permisosPersonalesSql =
      personalesR.recordset;
    const permisosOficialesSql =
      oficialesR.recordset;

    console.log(
      `✅ Empleados nuevos desde ${FECHA_CORTE}: ${empleados.length}`,
    );

    console.log(
      `✅ Permisos personales desde ${FECHA_CORTE}: ${permisosPersonalesSql.length}`,
    );

    console.log(
      `✅ Permisos oficiales desde ${FECHA_CORTE}: ${permisosOficialesSql.length}`,
    );

    /*
     * ========================================================
     * CARGAR DATOS POSTGRESQL
     * ========================================================
     */

    console.log("");
    console.log(
      "Cargando información existente desde PostgreSQL...",
    );

    const [
      usuariosPgR,
      empleadosPgR,
      rolesPgR,
      usuarioRolesPgR,
      tiposContratacionPgR,
      sexosPgR,
      estadosCivilesPgR,
      departamentosPgR,
      municipiosPgR,
      dependenciasPgR,
      cargosPgR,
      tiposSolicitudPgR,
      estadosSolicitudPgR,
      horasPgR,
      personalesPgR,
      oficialesPgR,
    ] = await Promise.all([
      pgPool.query(`
        SELECT
          idusuario,
          emailinstitucional,
          activo
        FROM core.usuarios
      `),

      pgPool.query(`
        SELECT
          idusuario,
          emailinstitucional,
          numidentidad,
          prinombre,
          priapellido,
          idcargo
        FROM rrhh.empleados
      `),

      pgPool.query(`
        SELECT
          idrol,
          nomrol
        FROM core.roles
        ORDER BY idrol
      `),

      pgPool.query(`
        SELECT
          idusuario,
          idrol
        FROM core.usuario_roles
      `),

      pgPool.query(`
        SELECT
          idtipocontratacion,
          nombre
        FROM rrhh.tipos_contrataciones
      `),

      pgPool.query(`
        SELECT
          idsexo,
          nomsexo
        FROM rrhh.sexos
      `),

      pgPool.query(`
        SELECT
          idestadocivil,
          nomestadocivil
        FROM rrhh.estados_civiles
      `),

      pgPool.query(`
        SELECT
          iddepartamento,
          nomdepartamento
        FROM rrhh.departamentos
      `),

      pgPool.query(`
        SELECT
          idmunicipio,
          nommunicipio,
          iddepartamento
        FROM rrhh.municipios
      `),

      pgPool.query(`
        SELECT
          iddependencia,
          nomdependencia
        FROM rrhh.dependencias
      `),

      pgPool.query(`
        SELECT
          idcargo,
          nomcargo,
          iddependencia
        FROM rrhh.cargos
      `),

      pgPool.query(`
        SELECT
          idtiposolicitud,
          nomtipo
        FROM rrhh.tipos_solicitudes_empleados
      `),

      pgPool.query(`
        SELECT
          idestadosolicitud,
          nomestado
        FROM rrhh.estados_solicitudes
      `),

      pgPool.query(`
        SELECT
          idhorasdisponible,
          emailinstitucional,
          hordisponibles
        FROM rrhh.horas_disponibles
      `),

      pgPool.query(`
        SELECT
          idpermisopersonal,
          idtiposolicitud,
          emailinstitucional,
          fecsolicitud,
          horsolicitadas,
          idhorasdisponibles,
          idestadosolicitud,
          motivo,
          catemergencia,
          priaprobacion,
          segaprobacion,
          motrechazo,
          tiempolimite,
          horsalida,
          horretorno,
          guardiaturno,
          creadoen,
          creadopor,
          actualizadoen,
          actualizadopor
        FROM rrhh.permisos_personales
      `),

      pgPool.query(`
        SELECT
          idpermisooficial,
          idtiposolicitud,
          emailinstitucional,
          fecsolicitud,
          idestadosolicitud,
          motivo,
          priaprobacion,
          segaprobacion,
          motrechazo,
          tiempolimite,
          horsalida,
          horretorno,
          guardiaturno,
          creadoen,
          creadopor,
          actualizadoen,
          actualizadopor
        FROM rrhh.permisos_oficiales
      `),
    ]);

    const usuariosPg = usuariosPgR.rows;
    const empleadosPg = empleadosPgR.rows;
    const rolesPg = rolesPgR.rows;
    const usuarioRolesPg = usuarioRolesPgR.rows;
    const tiposContratacionPg =
      tiposContratacionPgR.rows;
    const sexosPg = sexosPgR.rows;
    const estadosCivilesPg =
      estadosCivilesPgR.rows;
    const departamentosPg =
      departamentosPgR.rows;
    const municipiosPg = municipiosPgR.rows;
    const dependenciasPg =
      dependenciasPgR.rows;
    const cargosPg = cargosPgR.rows;
    const tiposSolicitudPg =
      tiposSolicitudPgR.rows;
    const estadosSolicitudPg =
      estadosSolicitudPgR.rows;
    const horasPg = horasPgR.rows;
    const permisosPersonalesPg =
      personalesPgR.rows;
    const permisosOficialesPg =
      oficialesPgR.rows;

    /*
     * ========================================================
     * MAPAS
     * ========================================================
     */

    const usuariosPorCorreo = new Map(
      usuariosPg.map((u) => [
        email(u.emailinstitucional),
        u,
      ]),
    );

    const empleadosPorCorreo = new Map(
      empleadosPg.map((e) => [
        email(e.emailinstitucional),
        e,
      ]),
    );

    const empleadosPorIdentidad = new Map(
      empleadosPg.map((e) => [
        identidad(e.numidentidad),
        e,
      ]),
    );

    const rolesSqlMap = new Map(
      rolesSql.map((r) => [
        Number(r.id),
        r,
      ]),
    );

    const rolesPgByName = new Map(
      rolesPg.map((r) => [
        text(r.nomrol),
        r,
      ]),
    );

    const rolesOrigenPorCorreo = new Map();

    for (const r of empleadosRoles) {
      const e = email(r.emailinstitucional);

      if (!e) {
        continue;
      }

      const lista =
        rolesOrigenPorCorreo.get(e) ?? [];

      lista.push(r);

      rolesOrigenPorCorreo.set(e, lista);
    }

    const tipoContratacionSqlMap =
      new Map(
        tiposContratacionSql.map((r) => [
          Number(r.id),
          r,
        ]),
      );

    const sexosSqlMap =
      new Map(
        sexosSql.map((r) => [
          Number(r.id),
          r,
        ]),
      );

    const estadosCivilesSqlMap =
      new Map(
        estadosCivilesSql.map((r) => [
          Number(r.id),
          r,
        ]),
      );

    const departamentosSqlMap =
      new Map(
        departamentosSql.map((r) => [
          Number(r.id),
          r,
        ]),
      );

    const municipiosSqlMap =
      new Map(
        municipiosSql.map((r) => [
          Number(r.id),
          r,
        ]),
      );

    const dependenciasSqlMap =
      new Map(
        dependenciasSql.map((r) => [
          Number(r.id),
          r,
        ]),
      );

    const cargosSqlMap =
      new Map(
        cargosSql.map((r) => [
          Number(r.id),
          r,
        ]),
      );

    const tiposSolicitudSqlMap =
      new Map(
        tiposSolicitudSql.map((r) => [
          Number(r.id),
          r,
        ]),
      );

    const estadosSolicitudSqlMap =
      new Map(
        estadosSolicitudSql.map((r) => [
          Number(r.id),
          r,
        ]),
      );

    const tipoContratacionPgMap =
      new Map(
        tiposContratacionPg.map((r) => [
          text(r.nombre),
          r,
        ]),
      );

    const sexosPgMap =
      new Map(
        sexosPg.map((r) => [
          text(r.nomsexo),
          r,
        ]),
      );

    const estadosCivilesPgMap =
      new Map(
        estadosCivilesPg.map((r) => [
          text(r.nomestadocivil),
          r,
        ]),
      );

    const departamentosPgMap =
      new Map(
        departamentosPg.map((r) => [
          text(r.nomdepartamento),
          r,
        ]),
      );

    const municipiosPgMap =
      new Map(
        municipiosPg.map((r) => [
          `${text(r.nommunicipio)}|${Number(
            r.iddepartamento,
          )}`,
          r,
        ]),
      );

    const dependenciasPgMap =
      new Map(
        dependenciasPg.map((r) => [
          text(r.nomdependencia),
          r,
        ]),
      );

    const cargosPgMap = new Map();

    for (const c of cargosPg) {
      const key = `${text(
        c.nomcargo,
      )}|${Number(c.iddependencia)}`;

      const lista =
        cargosPgMap.get(key) ?? [];

      lista.push(c);

      cargosPgMap.set(key, lista);
    }

    const tiposSolicitudPgMap =
      new Map(
        tiposSolicitudPg.map((r) => [
          text(r.nomtipo),
          r,
        ]),
      );

    const estadosSolicitudPgMap =
      new Map(
        estadosSolicitudPg.map((r) => [
          text(r.nomestado),
          r,
        ]),
      );

    const horasPorCorreo = new Map(
      horasPg.map((h) => [
        email(h.emailinstitucional),
        h,
      ]),
    );

    /*
     * ========================================================
     * FUNCIÓN PARA MAPEAR CARGO
     * ========================================================
     */

    function obtenerCargoDestino(idCargo) {
      const mapeado =
        MAPEO_CARGOS_SQL_PG.get(
          Number(idCargo),
        );

      if (mapeado !== undefined) {
        return (
          cargosPg.find(
            (c) =>
              Number(c.idcargo) ===
              mapeado,
          ) ?? null
        );
      }

      const origen =
        cargosSqlMap.get(
          Number(idCargo),
        );

      if (!origen) {
        return null;
      }

      const dependenciaOrigen =
        dependenciasSqlMap.get(
          Number(origen.iddependencia),
        );

      if (!dependenciaOrigen) {
        return null;
      }

      const dependenciaDestino =
        dependenciasPgMap.get(
          text(dependenciaOrigen.nombre),
        );

      if (!dependenciaDestino) {
        return null;
      }

      const candidatos =
        cargosPgMap.get(
          `${text(
            origen.nombre,
          )}|${Number(
            dependenciaDestino.iddependencia,
          )}`,
        ) ?? [];

      return candidatos.length === 1
        ? candidatos[0]
        : null;
    }

    /*
     * ========================================================
     * RESULTADOS
     * ========================================================
     */

    const result = {
      fechaCorte: FECHA_CORTE,

      empleadosOrigen:
        empleados.length,

      empleadosYaExistentes: 0,

      empleadosFaltantes:
        0,

      empleadosInsertados:
        0,

      empleadosPendientes:
        0,

      usuariosCreados:
        0,

      horasNecesarias:
        0,

      horasYaExistentes:
        0,

      horasNuevas:
        0,

      personalesOrigen:
        permisosPersonalesSql.length,

      personalesYaExistentes:
        0,

      personalesFaltantes:
        0,

      personalesInsertados:
        0,

      personalesPendientes:
        0,

      oficialesOrigen:
        permisosOficialesSql.length,

      oficialesYaExistentes:
        0,

      oficialesFaltantes:
        0,

      oficialesInsertados:
        0,

      oficialesPendientes:
        0,

      conflictos: 0,

      errores: 0,

      detalles: [],
    };

    /*
     * ========================================================
     * 1. EMPLEADOS NUEVOS
     * ========================================================
     */

    console.log("");
    console.log(
      "============================================================",
    );
    console.log(
      "PROCESANDO EMPLEADOS NUEVOS",
    );
    console.log(
      "============================================================",
    );

    for (const src of empleados) {
      const e = email(
        src.emailinstitucional,
      );

      const ident = identidad(
        src.numidentidad,
      );

      if (!e) {
        result.conflictos++;

        result.detalles.push({
          accion:
            "EMPLEADO_SIN_CORREO",
          detalle:
            "Empleado nuevo sin correo institucional.",
        });

        continue;
      }

      /*
       * Buscar por correo.
       */
      let empleadoDestino =
        empleadosPorCorreo.get(e);

      /*
       * Si no está por correo,
       * buscar por identidad.
       */
      if (!empleadoDestino && ident) {
        empleadoDestino =
          empleadosPorIdentidad.get(
            ident,
          );
      }

      /*
       * Si ya existe, NO TOCAR.
       */
      if (empleadoDestino) {
        result.empleadosYaExistentes++;

        result.detalles.push({
          email: e,
          accion:
            "EMPLEADO_YA_EXISTE",
          detalle:
            "El empleado creado después de la fecha de corte ya existe en PostgreSQL. No se modifica.",
        });

        continue;
      }

      result.empleadosFaltantes++;

      /*
       * Catálogos.
       */

      const tipoOrigen =
        tipoContratacionSqlMap.get(
          Number(
            src.idtipocontratacion,
          ),
        );

      const sexoOrigen =
        sexosSqlMap.get(
          Number(src.idsexo),
        );

      const estadoCivilOrigen =
        estadosCivilesSqlMap.get(
          Number(
            src.idestadocivil,
          ),
        );

      if (
        !tipoOrigen ||
        !sexoOrigen ||
        !estadoCivilOrigen
      ) {
        result.empleadosPendientes++;

        result.detalles.push({
          email: e,
          accion:
            "EMPLEADO_CATALOGO_FALTANTE",
          detalle:
            "No fue posible mapear tipo de contratación, sexo o estado civil.",
        });

        continue;
      }

      const tipoDestino =
        tipoContratacionPgMap.get(
          text(tipoOrigen.nombre),
        );

      const sexoDestino =
        sexosPgMap.get(
          text(sexoOrigen.nombre),
        );

      const estadoCivilDestino =
        estadosCivilesPgMap.get(
          text(
            estadoCivilOrigen.nombre,
          ),
        );

      if (
        !tipoDestino ||
        !sexoDestino ||
        !estadoCivilDestino
      ) {
        result.empleadosPendientes++;

        result.detalles.push({
          email: e,
          accion:
            "EMPLEADO_CATALOGO_DESTINO_FALTANTE",
          detalle:
            "El catálogo correspondiente no existe en PostgreSQL.",
        });

        continue;
      }

      /*
       * Cargo.
       */

      const cargoDestino =
        obtenerCargoDestino(
          Number(src.idcargo),
        );

      if (!cargoDestino) {
        result.empleadosPendientes++;

        result.detalles.push({
          email: e,
          accion:
            "EMPLEADO_CARGO_FALTANTE",
          detalle:
            `No se pudo mapear IdCargo SQL=${src.idcargo}.`,
        });

        continue;
      }

      /*
       * Municipio.
       */

      let municipioId = null;

      if (src.idmunicipio != null) {
        const municipioOrigen =
          municipiosSqlMap.get(
            Number(src.idmunicipio),
          );

        if (!municipioOrigen) {
          result.empleadosPendientes++;

          result.detalles.push({
            email: e,
            accion:
              "EMPLEADO_MUNICIPIO_FALTANTE",
            detalle:
              `No existe municipio SQL=${src.idmunicipio}.`,
          });

          continue;
        }

        const departamentoOrigen =
          departamentosSqlMap.get(
            Number(
              municipioOrigen.iddepartamento,
            ),
          );

        if (!departamentoOrigen) {
          result.empleadosPendientes++;

          result.detalles.push({
            email: e,
            accion:
              "EMPLEADO_DEPARTAMENTO_FALTANTE",
            detalle:
              "No existe departamento de origen.",
          });

          continue;
        }

        const departamentoDestino =
          departamentosPgMap.get(
            text(
              departamentoOrigen.nombre,
            ),
          );

        if (!departamentoDestino) {
          result.empleadosPendientes++;

          result.detalles.push({
            email: e,
            accion:
              "EMPLEADO_DEPARTAMENTO_DESTINO_FALTANTE",
            detalle:
              `No existe departamento destino para ${departamentoOrigen.nombre}.`,
          });

          continue;
        }

        const municipioDestino =
          municipiosPgMap.get(
            `${text(
              municipioOrigen.nombre,
            )}|${Number(
              departamentoDestino.iddepartamento,
            )}`,
          );

        if (!municipioDestino) {
          result.empleadosPendientes++;

          result.detalles.push({
            email: e,
            accion:
              "EMPLEADO_MUNICIPIO_DESTINO_FALTANTE",
            detalle:
              `No existe municipio destino para ${municipioOrigen.nombre}.`,
          });

          continue;
        }

        municipioId =
          Number(
            municipioDestino.idmunicipio,
          );
      }

      /*
       * Roles del empleado nuevo.
       */

      const rolesOrigen =
        (
          rolesOrigenPorCorreo.get(e) ??
          []
        );

      if (!rolesOrigen.length) {
        result.empleadosPendientes++;

        result.detalles.push({
          email: e,
          accion:
            "EMPLEADO_SIN_ROLES",
          detalle:
            "El empleado nuevo no tiene registro en EMPLEADOS_ROLES.",
        });

        continue;
      }

      const principal =
        rolesOrigen[0];

      const password =
        String(
          principal.contrasena ??
            "",
        ).trim();

      if (!password) {
        result.empleadosPendientes++;

        result.detalles.push({
          email: e,
          accion:
            "EMPLEADO_SIN_CONTRASENA",
          detalle:
            "El empleado nuevo no tiene contraseña disponible.",
        });

        continue;
      }

      const rolesDestino = [];

      for (const rolOrigen of rolesOrigen) {
        const rolSql =
          rolesSqlMap.get(
            Number(rolOrigen.idrol),
          );

        const rolPg = rolSql
  ? (
      rolesPgByName.get(text(rolSql.nombre)) ??
      rolesPg.find(
        (r) => Number(r.idrol) === Number(rolSql.id),
      )
    )
  : undefined;

        if (rolPg) {
          rolesDestino.push(
            Number(rolPg.idrol),
          );
        }
      }

      if (!rolesDestino.length) {
        result.empleadosPendientes++;

        result.detalles.push({
          email: e,
          accion:
            "EMPLEADO_ROL_NO_MAPEADO",
          detalle:
            "No se pudo mapear el rol del empleado nuevo.",
        });

        continue;
      }

      /*
       * DRY RUN:
       * solamente informar.
       */

      if (DRY_RUN) {
        result.detalles.push({
          email: e,
          accion:
            "EMPLEADO_NUEVO_LISTO",
          detalle:
            `Se insertaría empleado y usuario. Cargo PG=${cargoDestino.idcargo}. Roles PG=[${rolesDestino.join(",")}]`,
        });

        continue;
      }

      /*
       * Crear usuario.
       */

      const hash =
        await bcrypt.hash(
          password,
          12,
        );

      const usuarioResult =
        await pgPool.query(
          `
          INSERT INTO core.usuarios(
            emailinstitucional,
            prinombre,
            segnombre,
            priapellido,
            segapellido,
            contrasena,
            activo,
            debecambiarpassword,
            creadoen,
            creadopor
          )
          VALUES(
            $1,$2,$3,$4,$5,$6,$7,TRUE,
            COALESCE($8::date,CURRENT_DATE),
            $9
          )
          RETURNING idusuario
          `,
          [
            e,
            nullable(src.prinombre),
            nullable(src.segnombre),
            nullable(src.priapellido),
            nullable(src.segapellido),
            hash,
            bool(principal.activo),
            dateOnly(src.creadoen),
            src.creadopor ??
              MIGRACION_CREADOR,
          ],
        );

      const usuario =
        usuarioResult.rows[0];

      if (!usuario) {
        throw new Error(
          `No se pudo crear usuario para ${e}.`,
        );
      }

      /*
       * Roles.
       */

      for (const rolId of rolesDestino) {
        await pgPool.query(
          `
          INSERT INTO core.usuario_roles(
            idusuario,
            idrol
          )
          VALUES(
            $1::uuid,
            $2::smallint
          )
          ON CONFLICT DO NOTHING
          `,
          [
            usuario.idusuario,
            rolId,
          ],
        );
      }

      /*
       * Empleado.
       */

      await pgPool.query(
        `
        INSERT INTO rrhh.empleados(
          emailinstitucional,
          prinombre,
          segnombre,
          priapellido,
          segapellido,
          fecinglaborar,
          actlaboralmente,
          numidentidad,
          numtelefono,
          idtipocontratacion,
          idcargo,
          idsupinmediato,
          idsexo,
          idestadocivil,
          idmunicipio,
          creadoen,
          creadopor,
          actualizadoen,
          actualizadopor,
          idusuario
        )
        VALUES(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10::uuid,$11,$12,
          $13::uuid,$14::uuid,$15,
          COALESCE($16::date,CURRENT_DATE),
          $17,
          $18,
          $19,
          $20::uuid
        )
        `,
        [
          e,
          nullable(src.prinombre),
          nullable(src.segnombre),
          nullable(src.priapellido),
          nullable(src.segapellido),
          dateOnly(src.fecinglaborar),
          bool(src.actlaboralmente),
          nullable(src.numidentidad),
          nullable(src.numtelefono),
          tipoDestino.idtipocontratacion,
          cargoDestino.idcargo,
          nullable(src.idsupinmediato),
          sexoDestino.idsexo,
          estadoCivilDestino.idestadocivil,
          municipioId,
          dateOnly(src.creadoen),
          src.creadopor ??
            MIGRACION_CREADOR,
          dateOnly(src.actualizadoen),
          src.actualizadopor,
          usuario.idusuario,
        ],
      );

      /*
       * Actualizar mapas en memoria para que
       * los permisos nuevos del empleado puedan
       * resolverse inmediatamente.
       */

      const nuevoEmpleado = {
        idusuario:
          usuario.idusuario,
        emailinstitucional: e,
        numidentidad:
          src.numidentidad,
        prinombre:
          src.prinombre,
        priapellido:
          src.priapellido,
        idcargo:
          cargoDestino.idcargo,
      };

      empleadosPorCorreo.set(
        e,
        nuevoEmpleado,
      );

      if (ident) {
        empleadosPorIdentidad.set(
          ident,
          nuevoEmpleado,
        );
      }

      usuariosPorCorreo.set(
        e,
        usuario,
      );

      result.empleadosInsertados++;
      result.usuariosCreados++;
    }

    /*
     * ========================================================
     * 2. HORAS NECESARIAS PARA PERMISOS NUEVOS
     * ========================================================
     */

    console.log("");
    console.log(
      "============================================================",
    );
    console.log(
      "PREPARANDO HORAS NECESARIAS",
    );
    console.log(
      "============================================================",
    );

    /*
     * Las horas NO se migran completas.
     * Solo se crea una hora si un permiso NUEVO
     * la necesita y no existe en PostgreSQL.
     */

    let maxHoraId =
      horasPg.length > 0
        ? Math.max(
            ...horasPg.map((h) =>
              Number(
                h.idhorasdisponible,
              ),
            ),
          )
        : 0;

    const horasPorIdOrigen =
      new Map();

    /*
     * Primero mapear las horas que ya existen
     * por correo.
     */

    for (const h of horasSql) {
      const e = email(
        h.emailinstitucional,
      );

      const destino =
        horasPorCorreo.get(e);

      if (destino) {
        horasPorIdOrigen.set(
          Number(
            h.idhorasdisponible,
          ),
          Number(
            destino.idhorasdisponible,
          ),
        );
      }
    }

    /*
     * Función para obtener/crear hora necesaria.
     */

    async function obtenerHoraDestino(
      horaOrigenId,
      emailEmpleado,
    ) {
      const idOrigen =
        Number(horaOrigenId);

      if (
        horasPorIdOrigen.has(
          idOrigen,
        )
      ) {
        result.horasYaExistentes++;

        return horasPorIdOrigen.get(
          idOrigen,
        );
      }

      const horaOrigen =
        horasSql.find(
          (h) =>
            Number(
              h.idhorasdisponible,
            ) === idOrigen,
        );

      if (!horaOrigen) {
        return null;
      }

      const correoOrigen =
        email(
          horaOrigen.emailinstitucional,
        );

      if (
        correoOrigen !==
        emailEmpleado
      ) {
        return null;
      }

      const horaDestinoExistente =
        horasPorCorreo.get(
          correoOrigen,
        );

      if (horaDestinoExistente) {
        const idDestino =
          Number(
            horaDestinoExistente.idhorasdisponible,
          );

        horasPorIdOrigen.set(
          idOrigen,
          idDestino,
        );

        result.horasYaExistentes++;

        return idDestino;
      }

      /*
       * Esta hora realmente hace falta.
       */

      maxHoraId++;

      const nuevoId =
        maxHoraId;

      result.horasNecesarias++;
      result.horasNuevas++;

      result.detalles.push({
        email: correoOrigen,
        accion:
          "HORA_NUEVA_NECESARIA",
        detalle:
          `IdHorasDisponible SQL=${idOrigen}; nuevo ID PostgreSQL=${nuevoId}`,
      });

      if (!DRY_RUN) {
        await pgPool.query(
          `
          INSERT INTO rrhh.horas_disponibles(
            idhorasdisponible,
            emailinstitucional,
            hordisponibles,
            creadoen,
            creadopor,
            actualizadoen,
            actualizadopor
          )
          VALUES(
            $1,$2,$3,
            COALESCE($4::date,CURRENT_DATE),
            $5,
            $6,
            $7
          )
          `,
          [
            nuevoId,
            correoOrigen,
            timeText(
              horaOrigen.hordisponibles,
            ),
            dateOnly(
              horaOrigen.creadoen,
            ),
            horaOrigen.creadopor ??
              MIGRACION_CREADOR,
            dateOnly(
              horaOrigen.actualizadoen,
            ),
            horaOrigen.actualizadopor,
          ],
        );
      }

      horasPorIdOrigen.set(
        idOrigen,
        nuevoId,
      );

      horasPorCorreo.set(
        correoOrigen,
        {
          idhorasdisponible:
            nuevoId,
          emailinstitucional:
            correoOrigen,
          hordisponibles:
            horaOrigen.hordisponibles,
        },
      );

      return nuevoId;
    }

    /*
     * ========================================================
     * 3. PERMISOS PERSONALES
     * ========================================================
     */

    console.log("");
    console.log(
      "============================================================",
    );
    console.log(
      "PROCESANDO PERMISOS PERSONALES",
    );
    console.log(
      "============================================================",
    );

    /*
     * Construir claves de permisos existentes.
     *
     * La clave se mantiene igual a la migración
     * anterior para no duplicar registros.
     */

    const personalesExistentes =
      new Set();

    for (const p of permisosPersonalesPg) {
      personalesExistentes.add(
        [
          email(
            p.emailinstitucional,
          ),
          String(
            p.idtiposolicitud,
          ),
          dateOnly(
            p.fecsolicitud,
          ) ?? "",
          String(
            p.idhorasdisponibles ??
              "",
          ),
          text(p.motivo),
          timeText(
            p.horsalida,
          ) ?? "",
          timeText(
            p.horretorno,
          ) ?? "",
        ].join("|"),
      );
    }

    for (const p of permisosPersonalesSql) {
      const e = email(
        p.emailinstitucional,
      );

      if (
        esExEmpleadoExcluido(e)
      ) {
        continue;
      }

      const tipoOrigen =
        tiposSolicitudSqlMap.get(
          Number(
            p.idtiposolicitud,
          ),
        );

      const estadoOrigen =
        estadosSolicitudSqlMap.get(
          Number(
            p.idestadosolicitud,
          ),
        );

      if (
        !tipoOrigen ||
        !estadoOrigen
      ) {
        result.conflictos++;

        result.detalles.push({
          email: e,
          accion:
            "PERSONAL_CATALOGO_ORIGEN_FALTANTE",
          detalle:
            "No existe tipo o estado en SQL Server.",
        });

        continue;
      }

      const tipoDestino =
        tiposSolicitudPgMap.get(
          text(tipoOrigen.nombre),
        );

      const estadoDestino =
        estadosSolicitudPgMap.get(
          text(estadoOrigen.nombre),
        );

      if (
        !tipoDestino ||
        !estadoDestino
      ) {
        result.conflictos++;

        result.detalles.push({
          email: e,
          accion:
            "PERSONAL_CATALOGO_DESTINO_FALTANTE",
          detalle:
            `No existe tipo o estado en PostgreSQL para el permiso.`,
        });

        continue;
      }

      /*
       * El empleado debe existir.
       */

      const empleadoDestino =
        empleadosPorCorreo.get(e);

      if (!empleadoDestino) {
        result.personalesPendientes++;

        result.detalles.push({
          email: e,
          accion:
            "PERSONAL_EMPLEADO_NO_EXISTE",
          detalle:
            "No existe el empleado en PostgreSQL.",
        });

        continue;
      }

      /*
       * Obtener hora necesaria.
       */

      const horaId =
        await obtenerHoraDestino(
          p.idhorasdisponibles,
          e,
        );

      if (!horaId) {
        result.personalesPendientes++;

        result.detalles.push({
          email: e,
          accion:
            "PERSONAL_HORA_NO_MAPEADA",
          detalle:
            `No se pudo mapear IdHorasDisponibles SQL=${p.idhorasdisponibles}.`,
        });

        continue;
      }

      /*
       * Construir clave.
       */

      const clave = [
        e,
        String(
          tipoDestino.idtiposolicitud,
        ),
        dateOnly(
          p.fecsolicitud,
        ) ?? "",
        String(horaId),
        text(p.motivo),
        timeText(
          p.horsalida,
        ) ?? "",
        timeText(
          p.horretorno,
        ) ?? "",
      ].join("|");

      /*
       * Ya existe.
       */

      if (
        personalesExistentes.has(
          clave,
        )
      ) {
        result.personalesYaExistentes++;

        continue;
      }

      /*
       * Falta.
       */

      result.personalesFaltantes++;

      result.detalles.push({
        email: e,
        accion:
          "PERSONAL_NUEVO_FALTANTE",
        detalle:
          `Fecha=${dateOnly(
            p.fecsolicitud,
          )}; Motivo=${text(
            p.motivo,
          )}`,
      });

      if (DRY_RUN) {
        continue;
      }

      /*
       * INSERT.
       */

      await pgPool.query(
        `
        INSERT INTO rrhh.permisos_personales(
          idtiposolicitud,
          emailinstitucional,
          fecsolicitud,
          horsolicitadas,
          idhorasdisponibles,
          idestadosolicitud,
          motivo,
          catemergencia,
          priaprobacion,
          segaprobacion,
          motrechazo,
          tiempolimite,
          horsalida,
          horretorno,
          guardiaturno,
          creadoen,
          creadopor,
          actualizadoen,
          actualizadopor
        )
        VALUES(
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          $6::uuid,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          COALESCE($16::date,CURRENT_DATE),
          $17,
          $18,
          $19
        )
        `,
        [
          tipoDestino.idtiposolicitud,
          e,
          dateOnly(
            p.fecsolicitud,
          ),
          timeText(
            p.horsolicitadas,
          ),
          horaId,
          estadoDestino.idestadosolicitud,
          nullable(p.motivo),
          bool(p.catemergencia),
          nullable(
            p.priaprobacion,
          ),
          nullable(
            p.segaprobacion,
          ),
          nullable(
            p.motrechazo,
          ),
          timeText(
            p.tiempolimite,
          ),
          timeText(
            p.horsalida,
          ),
          timeText(
            p.horretorno,
          ),
          nullable(
            p.guardiaturno,
          ),
          dateOnly(
            p.creadoen,
          ),
          p.creadopor ??
            MIGRACION_CREADOR,
          dateOnly(
            p.actualizadoen,
          ),
          p.actualizadopor,
        ],
      );

      personalesExistentes.add(
        clave,
      );

      result.personalesInsertados++;
    }

    /*
     * ========================================================
     * 4. PERMISOS OFICIALES
     * ========================================================
     */

    console.log("");
    console.log(
      "============================================================",
    );
    console.log(
      "PROCESANDO PERMISOS OFICIALES",
    );
    console.log(
      "============================================================",
    );

    const oficialesExistentes =
      new Set();

    for (const p of permisosOficialesPg) {
      oficialesExistentes.add(
        [
          email(
            p.emailinstitucional,
          ),
          String(
            p.idtiposolicitud,
          ),
          dateOnly(
            p.fecsolicitud,
          ) ?? "",
          text(p.motivo),
          timeText(
            p.horsalida,
          ) ?? "",
          timeText(
            p.horretorno,
          ) ?? "",
        ].join("|"),
      );
    }

    for (const p of permisosOficialesSql) {
      const e = email(
        p.emailinstitucional,
      );

      if (
        esExEmpleadoExcluido(e)
      ) {
        continue;
      }

      const tipoOrigen =
        tiposSolicitudSqlMap.get(
          Number(
            p.idtiposolicitud,
          ),
        );

      const estadoOrigen =
        estadosSolicitudSqlMap.get(
          Number(
            p.idestadosolicitud,
          ),
        );

      if (
        !tipoOrigen ||
        !estadoOrigen
      ) {
        result.conflictos++;

        result.detalles.push({
          email: e,
          accion:
            "OFICIAL_CATALOGO_ORIGEN_FALTANTE",
          detalle:
            "No existe tipo o estado en SQL Server.",
        });

        continue;
      }

      const tipoDestino =
        tiposSolicitudPgMap.get(
          text(tipoOrigen.nombre),
        );

      const estadoDestino =
        estadosSolicitudPgMap.get(
          text(estadoOrigen.nombre),
        );

      if (
        !tipoDestino ||
        !estadoDestino
      ) {
        result.conflictos++;

        result.detalles.push({
          email: e,
          accion:
            "OFICIAL_CATALOGO_DESTINO_FALTANTE",
          detalle:
            "No existe tipo o estado en PostgreSQL.",
        });

        continue;
      }

      /*
       * El empleado debe existir.
       */

      const empleadoDestino =
        empleadosPorCorreo.get(e);

      if (!empleadoDestino) {
        result.oficialesPendientes++;

        result.detalles.push({
          email: e,
          accion:
            "OFICIAL_EMPLEADO_NO_EXISTE",
          detalle:
            "No existe el empleado en PostgreSQL.",
        });

        continue;
      }

      /*
       * Clave del permiso oficial.
       */

      const clave = [
        e,
        String(
          tipoDestino.idtiposolicitud,
        ),
        dateOnly(
          p.fecsolicitud,
        ) ?? "",
        text(p.motivo),
        timeText(
          p.horsalida,
        ) ?? "",
        timeText(
          p.horretorno,
        ) ?? "",
      ].join("|");

      /*
       * Ya existe.
       */

      if (
        oficialesExistentes.has(
          clave,
        )
      ) {
        result.oficialesYaExistentes++;

        continue;
      }

      /*
       * Falta.
       */

      result.oficialesFaltantes++;

      result.detalles.push({
        email: e,
        accion:
          "OFICIAL_NUEVO_FALTANTE",
        detalle:
          `Fecha=${dateOnly(
            p.fecsolicitud,
          )}; Motivo=${text(
            p.motivo,
          )}`,
      });

      if (DRY_RUN) {
        continue;
      }

      /*
       * INSERT.
       */

      await pgPool.query(
        `
        INSERT INTO rrhh.permisos_oficiales(
          idtiposolicitud,
          emailinstitucional,
          fecsolicitud,
          idestadosolicitud,
          motivo,
          priaprobacion,
          segaprobacion,
          motrechazo,
          tiempolimite,
          horsalida,
          horretorno,
          guardiaturno,
          creadoen,
          creadopor,
          actualizadoen,
          actualizadopor
        )
        VALUES(
          $1::uuid,
          $2,
          $3,
          $4::uuid,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          COALESCE($13::date,CURRENT_DATE),
          $14,
          $15,
          $16
        )
        `,
        [
          tipoDestino.idtiposolicitud,
          e,
          dateOnly(
            p.fecsolicitud,
          ),
          estadoDestino.idestadosolicitud,
          nullable(p.motivo),
          nullable(
            p.priaprobacion,
          ),
          nullable(
            p.segaprobacion,
          ),
          nullable(
            p.motrechazo,
          ),
          timeText(
            p.tiempolimite,
          ),
          timeText(
            p.horsalida,
          ),
          timeText(
            p.horretorno,
          ),
          nullable(
            p.guardiaturno,
          ),
          dateOnly(
            p.creadoen,
          ),
          p.creadopor ??
            MIGRACION_CREADOR,
          dateOnly(
            p.actualizadoen,
          ),
          p.actualizadoPor ??
            p.actualizadopor,
        ],
      );

      oficialesExistentes.add(
        clave,
      );

      result.oficialesInsertados++;
    }

    /*
     * ========================================================
     * REPORTE
     * ========================================================
     */

    const dir = path.join(
      process.cwd(),
      "migration-reports",
    );

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {
        recursive: true,
      });
    }

    const stamp =
      new Date()
        .toISOString()
        .replace(
          /[:.]/g,
          "-",
        );

    const reportPath = path.join(
      dir,
      `migracion-incremental-${stamp}.json`,
    );

    const reporte = {
      fechaEjecucion:
        new Date().toISOString(),

      fechaCorte:
        FECHA_CORTE,

      modo: DRY_RUN
        ? "DRY_RUN"
        : "MIGRACION_REAL",

      alcance: {
        empleados: true,
        permisosPersonales: true,
        permisosOficiales: true,
        vacaciones: false,
        permisosEstudios: false,
        historialCargos: false,
        actualizaciones: false,
        eliminaciones: false,
      },

      resultado: result,
    };

    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        reporte,
        null,
        2,
      ),
      "utf8",
    );

    /*
     * ========================================================
     * RESUMEN
     * ========================================================
     */

    console.log("");
    console.log(
      "============================================================",
    );
    console.log(
      "                     RESUMEN",
    );
    console.log(
      "============================================================",
    );

    console.log("");
    console.log(
      "EMPLEADOS",
    );

    console.log(
      `  Origen desde fecha de corte:     ${result.empleadosOrigen}`,
    );

    console.log(
      `  Ya existentes:                   ${result.empleadosYaExistentes}`,
    );

    console.log(
      `  Faltantes:                       ${result.empleadosFaltantes}`,
    );

    console.log(
      `  Insertados:                      ${result.empleadosInsertados}`,
    );

    console.log(
      `  Pendientes:                      ${result.empleadosPendientes}`,
    );

    console.log("");
    console.log(
      "USUARIOS",
    );

    console.log(
      `  Usuarios creados:                ${result.usuariosCreados}`,
    );

    console.log("");
    console.log(
      "HORAS DISPONIBLES",
    );

    console.log(
      `  Ya existentes/necesarias:        ${result.horasYaExistentes}`,
    );

    console.log(
      `  Horas nuevas necesarias:         ${result.horasNuevas}`,
    );

    console.log("");
    console.log(
      "PERMISOS PERSONALES",
    );

    console.log(
      `  Origen desde fecha de corte:     ${result.personalesOrigen}`,
    );

    console.log(
      `  Ya existentes:                   ${result.personalesYaExistentes}`,
    );

    console.log(
      `  Faltantes:                       ${result.personalesFaltantes}`,
    );

    console.log(
      `  Insertados:                      ${result.personalesInsertados}`,
    );

    console.log(
      `  Pendientes:                      ${result.personalesPendientes}`,
    );

    console.log("");
    console.log(
      "PERMISOS OFICIALES",
    );

    console.log(
      `  Origen desde fecha de corte:     ${result.oficialesOrigen}`,
    );

    console.log(
      `  Ya existentes:                   ${result.oficialesYaExistentes}`,
    );

    console.log(
      `  Faltantes:                       ${result.oficialesFaltantes}`,
    );

    console.log(
      `  Insertados:                      ${result.oficialesInsertados}`,
    );

    console.log(
      `  Pendientes:                      ${result.oficialesPendientes}`,
    );

    console.log("");
    console.log(
      `  Conflictos:                      ${result.conflictos}`,
    );

    console.log(
      `  Errores:                         ${result.errores}`,
    );

    console.log("");
    console.log(
      `📄 Reporte: ${reportPath}`,
    );

    console.log("");

    if (DRY_RUN) {
      console.log(
        "✅ DRY_RUN=true: PostgreSQL NO FUE MODIFICADO.",
      );
    } else {
      console.log(
        "✅ MIGRACIÓN REAL FINALIZADA.",
      );
    }

    console.log("");
  } catch (err) {
    console.error("");
    console.error(
      "❌ ERROR DURANTE LA MIGRACIÓN INCREMENTAL",
    );
    console.error(err);

    process.exitCode = 1;
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }

    await pgPool.end();
  }
}

void main();