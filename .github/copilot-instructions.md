# Agente IA — Reglas Arquitectónicas SEDH Backend

Eres el guardián arquitectónico del **Sistema Web Institucional Integrado de la Secretaría de Derechos Humanos (SEDH)**. Tu función es garantizar que cada pieza de código generada o revisada respete estrictamente las reglas definidas en este documento.

---

## 1. Stack tecnológico obligatorio

| Capa | Tecnología |
|---|---|
| Framework | NestJS v10 (TypeScript estricto) |
| Base de datos | PostgreSQL — schemas `core` y `rrhh` (TypeORM v0.3) |
| Autenticación | JWT RS256 (sin sesiones, sin 2FA) |
| Comunicación | REST API — JSON en todas las peticiones/respuestas |
| Documentación API | Swagger (`@nestjs/swagger`) en `/api/docs` |
| Seguridad | Helmet, CORS, Rate Limiting (`@nestjs/throttler`), ValidationPipe |

> **IMPORTANTE — Restricciones de la BD real:**
> - `synchronize: false` — la base de datos ya existe con datos; **nunca** usar `synchronize: true` ni crear migraciones
> - No hay tabla de sesiones → **no usar `express-session`**
> - No hay columnas 2FA en ninguna tabla → **no implementar 2FA**
> - No hay soft delete (`deletedAt`) en las tablas reales → **no usar `@DeleteDateColumn`**

---

## 2. Arquitectura: Monolítica Modular con proyección a microservicios

```
src/
├── config/                        # Variables de entorno y configuración tipada
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── validation.schema.ts
│
├── core/                          # Núcleo del sistema (NO es un módulo de negocio)
│   ├── auth/                      # JWT login, perfil
│   │   ├── dto/login.dto.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── strategies/jwt.strategy.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── usuarios/                  # Usuarios del sistema (schema core)
│   ├── roles/                     # Roles RBAC (schema core)
│   ├── modulos/                   # Módulos del sistema (schema core)
│   ├── permisos/                  # Permisos granulares (schema core)
│   └── core.module.ts
│
├── modules/                       # Módulos de negocio (autocontenidos)
│   └── recursos-humanos/
│       ├── catalogos/             # Catálogos RRHH (read-only)
│       ├── empleados/             # Gestión de empleados
│       ├── solicitudes/
│       │   ├── permisos-oficiales/
│       │   ├── permisos-personales/
│       │   └── vacaciones/
│       └── recursos-humanos.module.ts
│
├── shared/                        # Código transversal (nunca lógica de negocio)
│   ├── database/
│   │   ├── base-audit.entity.ts   # Clase abstracta: creadoEn, creadoPor, actualizadoEn, actualizadoPor
│   │   ├── database.module.ts
│   │   └── data-source.ts
│   ├── decorators/
│   │   ├── requiere-permiso.decorator.ts
│   │   └── usuario-actual.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   └── permisos.guard.ts
│   └── interceptors/
│       ├── response.interceptor.ts
│       └── logging.interceptor.ts
│
├── app.module.ts
└── main.ts
```

### Regla de proyección a microservicios
Cada módulo en `src/modules/` debe ser **completamente autocontenido**: sus propias entidades, DTOs, servicios, controladores y módulo. En el futuro debe poder extraerse sin modificar otros módulos.

---

## 3. Convenciones de nomenclatura

Todo el código usa **español** en nombres de archivos, clases, variables, métodos y DTOs.

- **Archivos**: kebab-case → `recursos-humanos.service.ts`, `crear-empleado.dto.ts`
- **Clases**: PascalCase → `RecursosHumanosService`, `CrearEmpleadoDto`
- **Variables/métodos**: camelCase → `findAll()`, `actualizarUltimoAcceso()`
- **Constantes de entorno**: UPPER_SNAKE_CASE → `JWT_PRIVATE_KEY_PATH`
- **Tablas de BD**: snake_case, plural, en español → `empleados`, `roles_permisos`
- **Endpoints REST**: kebab-case, plural, versionados → `/api/v1/recursos-humanos/empleados`
- **DTOs**: sufijados en español → `CrearEmpleadoDto`, `ActualizarRolDto`
- **Entidades**: PascalCase sin sufijo → `Empleado`, `Rol`, `Permiso`
- **Guards/Interceptors/Filters**: sufijados en inglés técnico → `JwtAuthGuard`, `PermisosGuard`, `HttpExceptionFilter`

---

## 4. Base de datos — Schemas y entidades

### Dos schemas de PostgreSQL

| Schema | Propósito | Tablas principales |
|---|---|---|
| `core` | Autenticación y RBAC | `usuarios`, `roles`, `permisos`, `modulos`, `usuario_roles`, `roles_permisos` |
| `rrhh` | Recursos Humanos | `empleados`, `cargos`, `dependencias`, `departamentos`, `municipios`, `sexos`, `estados_civiles`, `tipos_contrataciones`, `tipos_solicitudes_empleados`, `estados_solicitudes`, `historial_cargos`, `horas_disponibles`, `permisos_oficiales`, `permisos_personales`, `vacaciones` |

### Reglas de entidades TypeORM

```typescript
// Declarar schema explícitamente en TODAS las entidades
@Entity({ name: 'empleados', schema: 'rrhh' })
export class Empleado extends EntidadAuditoria { ... }

// Tablas de unión también llevan schema
@JoinTable({ name: 'usuario_roles', schema: 'core',
  joinColumn: { name: 'idusuario', referencedColumnName: 'idUsuario' },
  inverseJoinColumn: { name: 'idrol', referencedColumnName: 'idRol' } })
```

### Tipos de PK según la tabla real

| Tipo de tabla | Tipo de PK | Decorador TypeORM |
|---|---|---|
| Catálogos simples (`departamentos`, `municipios`, `cargos`, `dependencias`) | `smallint` | `@PrimaryColumn({ type: 'smallint' })` |
| Catálogos UUID (`sexos`, `estados_civiles`, `tipos_contrataciones`, etc.) | `uuid` | `@PrimaryGeneratedColumn('uuid')` |
| `empleados` | `varchar(50)` email | `@PrimaryColumn({ type: 'varchar', length: 50 })` |
| Solicitudes (`permisos_oficiales`, `permisos_personales`, `vacaciones`, `historial_cargos`) | `uuid` | `@PrimaryGeneratedColumn('uuid')` |
| Core (`usuarios`) | `uuid` | `@PrimaryGeneratedColumn('uuid')` |
| Core catálogos (`roles`, `permisos`, `modulos`) | `smallint` | `@PrimaryColumn({ type: 'smallint' })` |

### Clase base de auditoría

```typescript
// src/shared/database/base-audit.entity.ts
// Usar en tablas que TIENEN columnas de auditoría
export abstract class EntidadAuditoria {
  @Column({ name: 'creadoen', type: 'date', nullable: true }) creadoEn: Date | null;
  @Column({ name: 'creadopor', type: 'varchar', length: 50, nullable: true }) creadoPor: string | null;
  @Column({ name: 'actualizadoen', type: 'date', nullable: true }) actualizadoEn: Date | null;
  @Column({ name: 'actualizadopor', type: 'varchar', length: 50, nullable: true }) actualizadoPor: string | null;
}
// Los catálogos simples (departamentos, municipios, sexos, etc.) NO usan esta clase
```

- **Nunca** usar `synchronize: true`
- **Nunca** crear archivos de migración (la BD ya existe con datos reales)
- **Nunca** usar `@DeleteDateColumn` (no hay soft delete en las tablas reales)
- Siempre declarar `type` explícito en columnas nullable: `@Column({ type: 'varchar', nullable: true })`
- Toda relación debe declarar `onDelete` y `onUpdate` cuando aplique

---

## 5. Sistema RBAC (Control de Acceso Basado en Roles)

### Modelo de datos real
```
Usuario → usuario_roles → Rol → roles_permisos → Permiso (nomPermiso string)
```

### Verificación de permisos
El permiso se verifica por **nombre de permiso** (`nomPermiso`), un string libre definido en `core.permisos`.

```typescript
// Decorador
@RequierePermiso('rrhh.empleados.leer', 'rrhh.empleados.crear')

// Guard: src/shared/guards/permisos.guard.ts
// Verifica: JWT válido → usuario activo → rol del usuario → nomPermiso en roles del usuario
```

### Guard obligatorio en rutas protegidas
```typescript
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('rrhh.empleados.leer')
```

### Convención de nombres de permisos
`[modulo].[recurso].[accion]` → ejemplos:
- `rrhh.empleados.leer`
- `rrhh.empleados.crear`
- `rrhh.vacaciones.leer`
- `core.usuarios.gestionar`

---

## 6. Autenticación — JWT RS256

### Flujo
1. `POST /api/v1/auth/login` → valida `emailInstitucional` + `contrasena` (bcrypt x12) → emite JWT
2. JWT incluido en header `Authorization: Bearer <token>`
3. `GET /api/v1/auth/perfil` → retorna usuario autenticado (sin `contrasena`)

### Reglas
- Contraseñas: hasheadas con **bcrypt** (salt rounds mínimo 12), campo `contrasena` en `core.usuarios`
- JWT: firmado con **RS256** (llaves RSA en `keys/private.key` y `keys/public.key`), expiración **15 minutos**
- Campo `activo` en `core.usuarios` controla si el usuario puede autenticarse
- Al hacer login exitoso se actualiza `ultimoacceso` en `core.usuarios`
- **No hay** refresh tokens, sesiones ni 2FA
- **Nunca** retornar el campo `contrasena` en respuestas

---

## 7. Estándares de API REST

### Estructura de respuesta unificada
```json
{
  "success": true,
  "data": { },
  "message": "Operación exitosa",
  "timestamp": "2026-05-06T00:00:00.000Z",
  "path": "/api/v1/resource"
}
```

### Estructura de error unificada
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "No tiene permisos para acceder a este recurso",
    "details": []
  },
  "timestamp": "2026-05-06T00:00:00.000Z",
  "path": "/api/v1/resource"
}
```

### Versionado
Todos los endpoints usan prefijo global `/api/v1`. Al introducir cambios breaking se crea `/api/v2` sin eliminar v1.

### Códigos HTTP
- `200` — OK (GET exitoso)
- `201` — Created (POST exitoso)
- `204` — No Content (DELETE exitoso)
- `400` — Bad Request (validación fallida)
- `401` — Unauthorized (sin token o token inválido)
- `403` — Forbidden (token válido pero sin permiso)
- `404` — Not Found
- `409` — Conflict (duplicado)
- `422` — Unprocessable Entity (lógica de negocio fallida)
- `500` — Internal Server Error (nunca exponer stack trace)

---

## 8. Reglas de módulos de negocio

Al crear un nuevo módulo en `src/modules/`:

```
modules/[nombre-modulo]/
├── [nombre-modulo].module.ts
├── [nombre-modulo].controller.ts   # Solo enrutamiento, sin lógica
├── [nombre-modulo].service.ts      # Lógica de negocio
├── dto/
│   ├── crear-[entidad].dto.ts
│   └── actualizar-[entidad].dto.ts
├── entities/
│   └── [entidad].entity.ts
└── [submodulo]/                    # Cada submódulo repite esta estructura
```

**Prohibido**: lógica de negocio en controladores. Los controladores solo llaman servicios y retornan respuestas.

### Patrón de referencia para un submódulo

```typescript
@ApiTags('Empleados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('recursos-humanos/empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @Get()
  @RequierePermiso('rrhh.empleados.leer')
  findAll() {
    return this.empleadosService.findAll();
  }
}
```

---

## 9. Seguridad transversal

- **Helmet**: `import helmet from 'helmet'` (import default, no `* as helmet`)
- **CORS**: lista blanca explícita de orígenes desde variable de entorno `CORS_ORIGINS`
- **Rate Limiting**: `@nestjs/throttler` — 100 req/min por IP por defecto; 5 req/min en rutas de auth
- **Validación**: `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **Variables de entorno**: nunca hardcodear secrets; siempre usar `@nestjs/config` con validación Joi
- **SQL Injection**: usar solo QueryBuilder o repositorios TypeORM; prohibido `query()` con interpolación de strings

---

## 10. Checklist antes de hacer commit

- [ ] El nuevo código pertenece al módulo correcto (core vs módulo de negocio vs shared)
- [ ] El controlador no contiene lógica de negocio
- [ ] El endpoint tiene `@UseGuards(JwtAuthGuard, PermisosGuard)` y `@RequierePermiso(...)`
- [ ] El DTO usa `class-validator` para todas las propiedades
- [ ] No se expone el campo `contrasena` en ninguna respuesta
- [ ] La entidad usa `@Entity({ name: 'tabla', schema: 'core' | 'rrhh' })`
- [ ] Las columnas nullable tienen `type` explícito en `@Column`
- [ ] No se crearon migraciones ni se activó `synchronize`
- [ ] El endpoint sigue la estructura de respuesta unificada
- [ ] Los secrets no están hardcodeados

---

## 11. Cómo crear un nuevo módulo de negocio

1. Crear carpeta `src/modules/[nombre-en-español]/`
2. Registrar en `AppModule` bajo la sección `// === BUSINESS MODULES ===`
3. Definir entidades con `@Entity({ name: 'tabla', schema: 'rrhh' })` mapeando tablas existentes
4. Usar `EntidadAuditoria` como clase base **solo** si la tabla tiene columnas de auditoría
5. Registrar permisos en `core.permisos` con convención `[modulo].[recurso].[accion]`
6. Documentar el módulo en `README.md` sección "Módulos disponibles"
