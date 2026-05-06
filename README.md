# SEDH Backend — Sistema Web Institucional Integrado
## Secretaría de Derechos Humanos

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | NestJS v10 + TypeScript estricto |
| Base de datos | PostgreSQL — schemas `core` y `rrhh` (TypeORM v0.3) |
| Autenticación | JWT RS256 (llaves asimétricas, 15 min) |
| Comunicación | REST API — JSON |
| Documentación | Swagger en `http://localhost:3000/api/docs` |
| Seguridad | Helmet, CORS, Rate Limiting (`@nestjs/throttler`), ValidationPipe |

---

## Estructura del proyecto

```
src/
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── validation.schema.ts
│
├── core/                          # Núcleo — schema 'core' de PostgreSQL
│   ├── auth/                      # Login JWT, perfil
│   ├── usuarios/                  # Gestión de usuarios del sistema
│   ├── roles/                     # Roles RBAC
│   ├── modulos/                   # Módulos del sistema
│   ├── permisos/                  # Permisos granulares
│   └── core.module.ts
│
├── modules/                       # Módulos de negocio — schema 'rrhh'
│   └── recursos-humanos/
│       ├── catalogos/             # Catálogos (read-only)
│       ├── empleados/             # Gestión de empleados
│       ├── solicitudes/
│       │   ├── permisos-oficiales/
│       │   ├── permisos-personales/
│       │   └── vacaciones/
│       └── recursos-humanos.module.ts
│
├── shared/
│   ├── database/
│   │   ├── base-audit.entity.ts   # EntidadAuditoria: creadoEn, creadoPor, actualizadoEn, actualizadoPor
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

keys/
├── private.key                    # RSA 4096 — firma JWT
└── public.key                     # RSA pública — verificación JWT
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
Crear archivo `.env` en la raíz con:

```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password
DB_NAME=sedh_qa

# JWT (RS256)
JWT_PRIVATE_KEY_PATH=keys/private.key
JWT_PUBLIC_KEY_PATH=keys/public.key
JWT_ACCESS_EXPIRATION=15m

# App
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
CORS_ORIGINS=http://localhost:4200

# Seguridad
SESSION_SECRET=genera-un-string-aleatorio-largo
ENCRYPTION_KEY=64-caracteres-hex
```

> Generar valores aleatorios:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # SESSION_SECRET
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ENCRYPTION_KEY
> ```

### 4. Iniciar en desarrollo
```bash
npm run start:dev
```

> ⚠️ **No ejecutar migraciones** — la base de datos ya existe con datos reales. `synchronize` está desactivado.

---

## Base de datos

El backend se conecta a una BD PostgreSQL existente con dos schemas:

| Schema | Tablas |
|---|---|
| `core` | `usuarios`, `roles`, `permisos`, `modulos`, `usuario_roles`, `roles_permisos` |
| `rrhh` | `empleados`, `cargos`, `dependencias`, `departamentos`, `municipios`, `sexos`, `estados_civiles`, `tipos_contrataciones`, `tipos_solicitudes_empleados`, `estados_solicitudes`, `historial_cargos`, `horas_disponibles`, `permisos_oficiales`, `permisos_personales`, `vacaciones` |

TypeORM opera en modo **read/write sin migraciones** (`synchronize: false`).

---

## Flujo de autenticación

```
POST /api/v1/auth/login
  Body: { emailInstitucional, contrasena }
  Response: { accessToken }

GET /api/v1/auth/perfil
  Header: Authorization: Bearer <accessToken>
  Response: { data: { idUsuario, emailInstitucional, roles, ... } }
```

---

## RBAC — Modelo de permisos

```
Usuario → usuario_roles → Rol → roles_permisos → Permiso (nomPermiso)
```

Los permisos se verifican por nombre (`nomPermiso`), con la convención `[modulo].[recurso].[accion]`:

```typescript
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequierePermiso('rrhh.empleados.leer')
```

Ejemplos de permisos:
- `rrhh.empleados.leer` / `rrhh.empleados.crear` / `rrhh.empleados.actualizar`
- `rrhh.vacaciones.leer`
- `rrhh.permisos-oficiales.leer`
- `core.usuarios.gestionar`

---

## Respuesta unificada

```json
{ "success": true,  "data": {},    "message": "Operación exitosa", "timestamp": "...", "path": "..." }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "...", "details": [] }, "timestamp": "...", "path": "..." }
```

---

## Endpoints disponibles

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/auth/login` | Iniciar sesión (rate limit: 5/min) |
| GET | `/api/v1/auth/perfil` | Perfil del usuario autenticado |

### Core
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/usuarios` | Listar usuarios |
| GET | `/api/v1/usuarios/:id` | Obtener usuario |
| POST | `/api/v1/usuarios` | Crear usuario |
| PATCH | `/api/v1/usuarios/:id` | Actualizar usuario |
| GET | `/api/v1/roles` | Listar roles |
| GET | `/api/v1/roles/:id` | Obtener rol |
| GET | `/api/v1/modulos` | Listar módulos |
| GET | `/api/v1/permisos` | Listar permisos |

### Recursos Humanos — Catálogos
| Método | Ruta |
|---|---|
| GET | `/api/v1/recursos-humanos/catalogos/cargos` |
| GET | `/api/v1/recursos-humanos/catalogos/dependencias` |
| GET | `/api/v1/recursos-humanos/catalogos/departamentos` |
| GET | `/api/v1/recursos-humanos/catalogos/municipios` |
| GET | `/api/v1/recursos-humanos/catalogos/sexos` |
| GET | `/api/v1/recursos-humanos/catalogos/estados-civiles` |
| GET | `/api/v1/recursos-humanos/catalogos/tipos-contrataciones` |
| GET | `/api/v1/recursos-humanos/catalogos/estados-solicitudes` |
| GET | `/api/v1/recursos-humanos/catalogos/tipos-solicitudes-empleados` |

### Recursos Humanos — Empleados
| Método | Ruta | Permiso requerido |
|---|---|---|
| GET | `/api/v1/recursos-humanos/empleados` | `rrhh.empleados.leer` |
| GET | `/api/v1/recursos-humanos/empleados/:email` | `rrhh.empleados.leer` |
| POST | `/api/v1/recursos-humanos/empleados` | `rrhh.empleados.crear` |
| PATCH | `/api/v1/recursos-humanos/empleados/:email` | `rrhh.empleados.actualizar` |
| GET | `/api/v1/recursos-humanos/empleados/:email/historial-cargos` | `rrhh.empleados.leer` |
| GET | `/api/v1/recursos-humanos/empleados/:email/horas-disponibles` | `rrhh.empleados.leer` |

### Recursos Humanos — Solicitudes
| Método | Ruta | Permiso requerido |
|---|---|---|
| GET | `/api/v1/recursos-humanos/permisos-oficiales` | `rrhh.permisos-oficiales.leer` |
| GET | `/api/v1/recursos-humanos/permisos-oficiales/empleado/:email` | `rrhh.permisos-oficiales.leer` |
| GET | `/api/v1/recursos-humanos/permisos-oficiales/:id` | `rrhh.permisos-oficiales.leer` |
| GET | `/api/v1/recursos-humanos/permisos-personales` | `rrhh.permisos-personales.leer` |
| GET | `/api/v1/recursos-humanos/permisos-personales/empleado/:email` | `rrhh.permisos-personales.leer` |
| GET | `/api/v1/recursos-humanos/permisos-personales/:id` | `rrhh.permisos-personales.leer` |
| GET | `/api/v1/recursos-humanos/vacaciones` | `rrhh.vacaciones.leer` |
| GET | `/api/v1/recursos-humanos/vacaciones/empleado/:email` | `rrhh.vacaciones.leer` |
| GET | `/api/v1/recursos-humanos/vacaciones/:id` | `rrhh.vacaciones.leer` |

---

## Módulos disponibles

| Módulo | Submódulos | Estado |
|---|---|---|
| Core (auth, usuarios, roles, módulos, permisos) | — | ✅ Implementado |
| Recursos Humanos | catalogos, empleados, permisos-oficiales, permisos-personales, vacaciones | ✅ Implementado |
| *(futuros módulos)* | — | 🔜 Pendiente |

