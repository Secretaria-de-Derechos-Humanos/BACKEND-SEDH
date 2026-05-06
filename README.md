# SEDH Backend — Sistema Web Institucional Integrado
## Secretaría de Derechos Humanos

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | NestJS + TypeScript estricto |
| Base de datos | PostgreSQL (TypeORM) |
| Autenticación | JWT (RS256) + Session Storage + 2FA (TOTP) |
| Comunicación | REST API — JSON |
| Cifrado | HTTPS + AES-256-GCM (secretos 2FA) |
| Documentación | Swagger (`/api/docs`) |
| Seguridad | Helmet, CORS, Rate Limiting, ValidationPipe |

---

## Estructura del proyecto

```
src/
├── config/                        # Variables de entorno y configuración tipada
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── validation.schema.ts
│
├── core/                          # Núcleo del sistema
│   ├── auth/                      # JWT, 2FA, sesiones, AuditLog
│   ├── users/                     # Empleados
│   ├── roles/                     # Roles RBAC
│   ├── permissions/               # Permisos granulares
│   └── core.module.ts
│
├── modules/                       # Módulos de negocio (autocontenidos)
│   └── human-resources/
│       ├── attendance/            # Control de Asistencias
│       ├── leave-reports/         # Reportes de Permisos
│       ├── requests/              # Solicitudes de Empleados
│       └── human-resources.module.ts
│
├── shared/                        # Código transversal
│   ├── database/                  # BaseEntity, DatabaseModule, migraciones
│   ├── decorators/                # CurrentEmployee, RequirePermissions
│   ├── filters/                   # HttpExceptionFilter
│   ├── guards/                    # PermissionsGuard
│   └── interceptors/              # ResponseInterceptor, LoggingInterceptor
│
├── app.module.ts
└── main.ts
```

---

## Configuración inicial

### 1. Instalar dependencias
```bash
npm install
```

### 2. Generar llaves RSA para JWT
```bash
mkdir keys
openssl genrsa -out keys/private.key 4096
openssl rsa -in keys/private.key -pubout -out keys/public.key
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con los valores reales
```

> **ENCRYPTION_KEY** — 64 caracteres hex (32 bytes):
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 4. Ejecutar migraciones
```bash
npm run migration:run
```

### 5. Iniciar en desarrollo
```bash
npm run start:dev
```

---

## Flujo de autenticación

```
POST /api/v1/auth/login  { email, password }
  ├── Sin 2FA  → { accessToken, refreshToken }
  └── Con 2FA  → { requires2FA: true, email }

POST /api/v1/auth/2fa/verify  { email, token }
  └── { accessToken, refreshToken }

Header: Authorization: Bearer <accessToken>
```

---

## RBAC — Modelo de permisos

```
Employee → Role → RolePermission → Permission (module + subModule + action)
```

Acciones: `read` | `create` | `update` | `delete` | `manage`

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({ module: 'human-resources', subModule: 'attendance', action: 'read' })
```

---

## Respuesta unificada

```json
{ "success": true,  "data": {},    "message": "...", "timestamp": "...", "path": "..." }
{ "success": false, "error": { "code": "...", "message": "...", "details": [] }, "timestamp": "...", "path": "..." }
```

---

## Módulos disponibles

| Módulo | Submódulos | Estado |
|---|---|---|
| Core (auth, users, roles, permissions) | — | ✅ Implementado |
| Recursos Humanos | attendance, leave-reports, requests | ✅ Implementado |
| *(futuros módulos)* | — | 🔜 Pendiente |

---

## Credenciales iniciales (seed)

| Campo | Valor |
|---|---|
| Email | `admin@sedh.gob` |
| Contraseña | `Admin@SEDH2026!` |

> ⚠️ Cambiar la contraseña del admin en el primer inicio de sesión.

