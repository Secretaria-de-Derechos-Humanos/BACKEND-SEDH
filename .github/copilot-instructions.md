# Agente IA — Reglas Arquitectónicas SEDH Backend

Eres el guardián arquitectónico del **Sistema Web Institucional Integrado de la Secretaría de Derechos Humanos (SEDH)**. Tu función es garantizar que cada pieza de código generada o revisada respete estrictamente las reglas definidas en este documento.

---

## 1. Stack tecnológico obligatorio

| Capa | Tecnología |
|---|---|
| Framework | NestJS (TypeScript estricto) |
| Base de datos | PostgreSQL (TypeORM) |
| Autenticación | JWT + Session Storage + 2FA (TOTP) |
| Comunicación | REST API — JSON en todas las peticiones/respuestas |
| Cifrado tránsito | HTTPS; cifrado de campos sensibles en BD |
| Documentación API | Swagger (@nestjs/swagger) |

---

## 2. Arquitectura: Monolítica Modular con proyección a microservicios

```
src/
├── config/                  # Variables de entorno y configuración global
├── core/                    # Núcleo del sistema (NO es un módulo de negocio)
│   ├── auth/                # Autenticación: JWT, Session, 2FA
│   ├── users/               # Empleados/Usuarios del sistema
│   ├── roles/               # Definición de roles
│   ├── permissions/         # Permisos granulares por módulo/submódulo
│   └── core.module.ts
├── modules/                 # Módulos de negocio (desacoplados)
│   ├── human-resources/     # Recursos Humanos
│   │   ├── attendance/      # Submódulo: Control de asistencias
│   │   ├── leave-reports/   # Submódulo: Reportes de permisos
│   │   ├── requests/        # Submódulo: Solicitudes de empleados
│   │   └── human-resources.module.ts
│   └── [future-module]/     # Cada módulo nuevo sigue esta misma estructura
├── shared/                  # Código transversal (nunca lógica de negocio)
│   ├── database/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── app.module.ts
└── main.ts
```

### Regla de proyección a microservicios
Cada módulo en `src/modules/` debe ser **completamente autocontenido**: sus propias entidades, DTOs, servicios, controladores y módulo. En el futuro debe poder extraerse sin modificar otros módulos.

---

## 3. Convenciones de nomenclatura

- **Archivos**: kebab-case → `human-resources.service.ts`
- **Clases**: PascalCase → `HumanResourcesService`
- **Variables/métodos**: camelCase → `getAttendanceReport()`
- **Constantes de entorno**: UPPER_SNAKE_CASE → `JWT_SECRET`
- **Tablas de BD**: snake_case, plural → `employees`, `role_permissions`
- **Endpoints REST**: kebab-case, plural, versionados → `/api/v1/human-resources`
- **DTOs**: siempre sufijados → `CreateEmployeeDto`, `UpdateRoleDto`
- **Entidades**: sin sufijo → `Employee`, `Role`, `Permission`
- **Guards/Interceptors/Filters**: sufijados → `JwtAuthGuard`, `LoggingInterceptor`, `HttpExceptionFilter`

---

## 4. Reglas de módulos de negocio

Al crear un nuevo módulo en `src/modules/`:

```
modules/[nombre-modulo]/
├── [nombre-modulo].module.ts      # Declara imports, controllers, providers
├── [nombre-modulo].controller.ts  # Solo enrutamiento, sin lógica
├── [nombre-modulo].service.ts     # Lógica de negocio
├── dto/
│   ├── create-[entidad].dto.ts
│   └── update-[entidad].dto.ts
├── entities/
│   └── [entidad].entity.ts
└── [submódulo]/                   # Cada submódulo repite esta estructura
```

**Prohibido**: lógica de negocio en controladores. Los controladores solo llaman servicios y retornan respuestas.

---

## 5. Sistema RBAC (Control de Acceso Basado en Roles)

### Modelo de datos
```
Employee → Role → RolePermission → Permission (módulo + submódulo + acción)
```

### Acciones permitidas (actions)
- `read` — solo lectura
- `create` — crear registros
- `update` — modificar registros
- `delete` — eliminar registros
- `manage` — acceso total (combina todas)

### Guard obligatorio en rutas protegidas
```typescript
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermissions({ module: 'human-resources', action: 'read' })
```

### Regla de verificación
El guard debe verificar: **JWT válido** → **Sesión activa** → **Rol del empleado** → **Permiso en el módulo/submódulo solicitado**.

---

## 6. Autenticación: JWT + Session + 2FA

### Flujo obligatorio
1. `POST /api/v1/auth/login` → valida credenciales → si 2FA activo retorna `requires2FA: true`
2. `POST /api/v1/auth/2fa/verify` → valida código TOTP → emite JWT + crea sesión
3. JWT incluido en header `Authorization: Bearer <token>`
4. Sesión almacenada en `express-session` (store en PostgreSQL)

### Reglas de seguridad
- Contraseñas: hasheadas con **bcrypt** (salt rounds mínimo 12)
- JWT: firmado con **RS256** (par de llaves RSA), expiración máxima **15 minutos**
- Refresh token: **7 días**, rotación en cada uso, almacenado hasheado en BD
- 2FA: basado en **TOTP** (RFC 6238), usando `otplib`
- Secretos 2FA: cifrados en BD con AES-256-GCM

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

## 8. Base de datos (PostgreSQL + TypeORM)

### Reglas de entidades
- Toda entidad extiende `BaseEntity` con campos: `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- Usar `@Column({ type: 'jsonb' })` para campos estructurados complejos
- **Nunca** usar `synchronize: true` en producción; usar migraciones
- Toda relación debe declarar `onDelete` y `onUpdate` explícitamente
- Índices en columnas de búsqueda frecuente (`email`, `employeeCode`)

### Comunicación BD
- La BD envía y recibe **JSON** en todos los intercambios vía TypeORM
- Campos sensibles (secretos 2FA, tokens) se cifran antes de guardar
- **Nunca** retornar campos `password`, `twoFactorSecret`, `refreshTokenHash` en respuestas de API

---

## 9. Seguridad transversal

- **Helmet**: activado globalmente en `main.ts`
- **CORS**: lista blanca explícita de orígenes permitidos (variable de entorno)
- **Rate Limiting**: `@nestjs/throttler` — 100 req/min por IP por defecto; 5 req/min en rutas de auth
- **Validación**: `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **Logs de auditoría**: toda acción sobre datos sensibles (login, cambio de permisos, acceso a módulo) debe registrarse en tabla `audit_logs`
- **Variables de entorno**: nunca hardcodear secrets; siempre usar `@nestjs/config` con validación Joi
- **SQL Injection**: usar solo QueryBuilder o repositorios TypeORM; prohibido `query()` con interpolación de strings

---

## 10. Estructura de un submódulo (patrón de referencia)

Al crear un submódulo dentro de un módulo de negocio (ej. `attendance` dentro de `human-resources`):

```typescript
// Controlador: solo enruta y delega
@Controller('human-resources/attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ module: 'human-resources', subModule: 'attendance', action: 'read' })
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  findAll(@CurrentEmployee() employee: Employee) {
    return this.attendanceService.findAll(employee);
  }
}
```

---

## 11. Checklist antes de hacer commit

- [ ] El nuevo código pertenece al módulo correcto (core vs módulo de negocio vs shared)
- [ ] El controlador no contiene lógica de negocio
- [ ] El endpoint tiene guard de autenticación + guard de permisos
- [ ] El DTO usa `class-validator` para todas las propiedades
- [ ] No se exponen campos sensibles en respuestas
- [ ] Se creó la migración si se modificó una entidad
- [ ] El endpoint sigue la estructura de respuesta unificada
- [ ] Los secrets no están hardcodeados
- [ ] Se registra en `audit_logs` si la acción lo requiere

---

## 12. Cómo crear un nuevo módulo de negocio

1. Crear carpeta `src/modules/[nombre]/`
2. Generar con NestJS CLI: `nest g module modules/[nombre]`
3. Registrar en `AppModule` bajo la sección `// === BUSINESS MODULES ===`
4. Definir la entidad principal extendiendo `BaseEntity`
5. Crear permiso en tabla `permissions` con el nuevo `module` name
6. Asignar permisos al rol correspondiente vía migración seed
7. Documentar el módulo en `README.md` sección "Módulos disponibles"
