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
CORS_ORIGINS=http://localhost:4200,https://qa.sedh.gob.hn

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

## Módulos disponibles

| Módulo | Submódulos | Estado |
|---|---|---|
| Core (auth, usuarios, roles, módulos, permisos) | — | ✅ Implementado |
| Recursos Humanos | catalogos, empleados, permisos-oficiales, permisos-personales, vacaciones | ✅ Implementado |
| *(futuros módulos)* | — | 🔜 Pendiente |

---

## Despliegue en producción (Windows Server 2022 + IIS)

El backend corre en producción bajo **IIS como reverse proxy HTTPS → PM2 → NestJS (puerto 3000)**.

- **URL pública:** `https://api.sedh.gob.hn`
- **Certificado SSL:** wildcard `*.sedh.gob.hn` (Sectigo)
- **Gestor de procesos:** PM2 (registrado como servicio de Windows — arranca automáticamente)

### Subir cambios a producción

```bash
# 1. detener el backend
pm2 stop sedh-backend

# 2. construir el backend
npm run build

# 3. Recargar el proceso (sin downtime)
pm2 restart sedh-backend --update-env

# 4. Guardar cambios
pm2 save
```

> No es necesario reiniciar IIS. IIS solo actúa como túnel HTTPS y no ejecuta código Node.js.

### Comandos PM2 útiles

```bash
pm2 list                     # Ver estado del proceso
pm2 logs sedh-backend        # Ver logs en tiempo real
pm2 restart sedh-backend     # Reiniciar el proceso
pm2 stop sedh-backend        # Detener el proceso
pm2 save                     # Guardar lista de procesos (persiste tras reinicio)
```



### Infraestructura del servidor

| Componente | Detalle |
|---|---|
| OS | Windows Server 2022 |
| Web server | IIS 10.0 con URL Rewrite + ARR |
| Puerto público | 443 (HTTPS) |
| Puerto interno Node.js | 3000 |
| Directorio IIS | `C:\inetpub\api-sedh\` |
| web.config | Reverse proxy `*` → `http://localhost:3000/{R:1}` |

