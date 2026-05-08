---
name: create-endpoint
description: 'Convenciones para crear endpoints NestJS en el backend SEDH. Define verbos HTTP, estructura de controladores, DTOs, nomenclatura de rutas y compatibilidad con el frontend Angular. Úsalo SIEMPRE que crees o modifiques un controlador, endpoint, servicio o DTO en el backend.'
user-invocable: false
---

# SKILL: Convenciones de Endpoints — SEDH Backend

## Verbo HTTP: SIEMPRE POST

> **Todos los endpoints usan `@Post()`, sin excepción.**  
> No se usan `@Get()`, `@Put()`, `@Patch()` ni `@Delete()` en ningún controlador.

El frontend Angular envía **todas** las peticiones como `POST` con datos en el body JSON.
El backend debe estar alineado con esa convención.

```typescript
// ✅ CORRECTO
@Post('mis-solicitudes')
getMisSolicitudes(@Body() body: EmailBodyDto) { ... }

@Post('crear')
crearEmpleado(@Body() dto: CrearEmpleadoDto) { ... }

@Post('actualizar')
actualizarEmpleado(@Body() dto: ActualizarEmpleadoDto) { ... }

@Post('eliminar')
eliminarRegistro(@Body() body: IdBodyDto) { ... }

// ❌ INCORRECTO — nunca usar estos verbos
@Get('mis-solicitudes')
@Put('actualizar/:id')
@Patch('actualizar')
@Delete('eliminar/:id')
```

---

## Datos: SIEMPRE en el Body (`@Body()`)

> **Nunca usar `@Param()` ni `@Query()`.**  
> Toda información, incluidos identificadores, email y filtros, va en el **cuerpo JSON**.

```typescript
// ✅ CORRECTO — identificadores y filtros en el body
@Post('detalle')
getDetalle(@Body() body: IdBodyDto) { ... }

@Post('mis-datos')
getMisDatos(@Body() body: EmailBodyDto) { ... }

// ❌ INCORRECTO — nunca en la URL ni query params
@Get('detalle/:id')
getDetalle(@Param('id') id: string) { ... }

@Get('buscar')
buscar(@Query('email') email: string) { ... }
```

---

## Nomenclatura de rutas — Prefijos cortos

Usar prefijos **cortos** en los controladores. La URL completa resultante es `/api/v1/<prefijo>/<accion>`.

| Módulo | Prefijo del `@Controller()` |
|---|---|
| Autenticación | `auth` |
| Recursos Humanos — Empleados | `rrhh/empleados` |
| Recursos Humanos — Catálogos | `rrhh/catalogos` |
| Recursos Humanos — Solicitudes Empleados | `rrhh/sol-emp` |
| Recursos Humanos — Permisos Oficiales | `rrhh/perm-of` |
| Recursos Humanos — Permisos Personales | `rrhh/perm-per` |
| Recursos Humanos — Vacaciones | `rrhh/vac` |
| Core — Usuarios | `core/usuarios` |
| Core — Roles | `core/roles` |
| Core — Permisos | `core/permisos` |
| Core — Módulos | `core/modulos` |

```typescript
// ✅ CORRECTO — prefijo corto
@Controller('rrhh/empleados')
export class EmpleadosController { ... }

// ❌ INCORRECTO — prefijo largo
@Controller('recursos-humanos/empleados')
export class EmpleadosController { ... }
```

---

## Estructura de un controlador — Plantilla base

```typescript
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../core/auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../../../shared/guards/permisos.guard';
import { RequierePermiso } from '../../../../shared/decorators/requiere-permiso.decorator';
import { UsuarioActual } from '../../../../shared/decorators/usuario-actual.decorator';
import { Usuario } from '../../../../core/usuarios/entities/usuario.entity';
import { MiServicio } from './mi.service';
import { CrearRecursoDto } from './dto/crear-recurso.dto';

@ApiTags('Nombre del módulo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('rrhh/recurso')
export class MiController {
  constructor(private readonly miServicio: MiServicio) {}

  @Post('listar')
  @ApiOperation({ summary: 'Obtener todos los registros' })
  @RequierePermiso('rrhh.recurso.leer')
  listar(@UsuarioActual() usuario: Usuario) {
    return this.miServicio.listar(usuario.emailInstitucional);
  }

  @Post('crear')
  @ApiOperation({ summary: 'Crear un registro' })
  @RequierePermiso('rrhh.recurso.crear')
  crear(@Body() dto: CrearRecursoDto, @UsuarioActual() usuario: Usuario) {
    return this.miServicio.crear(dto, usuario.emailInstitucional);
  }

  @Post('actualizar')
  @ApiOperation({ summary: 'Actualizar un registro' })
  @RequierePermiso('rrhh.recurso.actualizar')
  actualizar(@Body() dto: ActualizarRecursoDto, @UsuarioActual() usuario: Usuario) {
    return this.miServicio.actualizar(dto, usuario.emailInstitucional);
  }

  @Post('eliminar')
  @ApiOperation({ summary: 'Eliminar un registro' })
  @RequierePermiso('rrhh.recurso.eliminar')
  eliminar(@Body() body: IdBodyDto, @UsuarioActual() usuario: Usuario) {
    return this.miServicio.eliminar(body.id, usuario.emailInstitucional);
  }
}
```

---

## Obtener el email del usuario autenticado

**Usar `@UsuarioActual()` para extraer el email del JWT validado** — es más seguro que confiar en el body.

```typescript
// ✅ CORRECTO — extraer email del JWT con @UsuarioActual()
@Post('mis-datos')
getMisDatos(@UsuarioActual() usuario: Usuario) {
  return this.miServicio.getMisDatos(usuario.emailInstitucional);
}

// También válido cuando se recibe el email del frontend en el body
// (el frontend lo envía como { email: '...' })
@Post('datos-empleado')
getDatosEmpleado(@Body() body: EmailBodyDto) {
  return this.miServicio.getDatos(body.email);
}
```

> El frontend siempre envía el email del usuario autenticado en el body.  
> Usar `@UsuarioActual()` es más seguro porque extrae el email del JWT ya validado,  
> sin depender de que el cliente envíe el valor correcto.

---

## DTOs — Reglas

```typescript
import { IsEmail, IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO para recibir email (endpoints que consultan por usuario)
export class EmailBodyDto {
  @ApiProperty({ example: 'usuario@sedh.gob.hn' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

// DTO para recibir un ID (endpoints que operan sobre un registro)
export class IdBodyDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  id: string;
}

// DTO de creación
export class CrearRecursoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descripcion?: string;
}
```

Reglas de DTOs:
- Cada propiedad tiene `@ApiProperty()` o `@ApiPropertyOptional()` para Swagger
- Cada propiedad tiene al menos un decorador de `class-validator`
- Propiedades opcionales usan `@IsOptional()` y el tipo incluye `| undefined`
- Nombres de archivos: `crear-[entidad].dto.ts`, `actualizar-[entidad].dto.ts`
- Nombres de clases: `CrearEmpleadoDto`, `ActualizarSolicitudDto`, `EmailBodyDto`

---

## Guards y permisos — Obligatorio en todas las rutas

```typescript
// A nivel de controlador (aplica a todos los endpoints del controlador)
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('rrhh/recurso')
export class MiController {

  // En cada endpoint, declarar el permiso requerido
  @Post('listar')
  @RequierePermiso('rrhh.recurso.leer')
  listar() { ... }
}
```

Convención de nombres de permisos: `[modulo].[recurso].[accion]`

| Acción | Sufijo |
|---|---|
| Consultar / listar | `leer` |
| Crear registro | `crear` |
| Modificar registro | `actualizar` |
| Eliminar registro | `eliminar` |
| Operaciones administrativas | `gestionar` |

---

## Estructura de respuesta del backend

El `ResponseInterceptor` envuelve automáticamente todas las respuestas exitosas.  
**No retornar la envoltura manualmente** — solo retornar los datos.

```typescript
// ✅ CORRECTO — retornar solo los datos
return this.miServicio.listar();
// El interceptor lo convierte en:
// { "success": true, "data": [...], "message": "OK", "timestamp": "...", "path": "..." }

// ❌ INCORRECTO — no construir la envoltura manualmente
return { success: true, data: resultado, message: 'OK' };
```

### Respuesta exitosa (automática via interceptor)
```json
{
  "success": true,
  "data": { },
  "message": "Operación exitosa",
  "timestamp": "2026-05-08T00:00:00.000Z",
  "path": "/api/v1/rrhh/recurso/listar"
}
```

### Respuesta de error (automática via HttpExceptionFilter)
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "No tiene permisos para acceder a este recurso",
    "details": []
  },
  "timestamp": "2026-05-08T00:00:00.000Z",
  "path": "/api/v1/rrhh/recurso/listar"
}
```

---

## Tabla de compatibilidad Frontend ↔ Backend

| Frontend (Angular) | Backend (NestJS) |
|---|---|
| `this.http.post('/api/v1/rrhh/emp/listar', body)` | `@Post('listar')` en `@Controller('rrhh/emp')` |
| Body: `{ email: '...' }` | `@Body() body: EmailBodyDto` o `@UsuarioActual()` |
| Body: `{ id: '...' }` | `@Body() body: IdBodyDto` |
| Body: `{ ...campos }` | `@Body() dto: CrearRecursoDto` |
| Espera `response.data` | Retorno del servicio (envuelto por interceptor) |
| Maneja `response.error` | Excepción lanzada (envuelta por filtro) |

---

## Patrón de servicio — Funciones PostgreSQL

Las funciones de BD devuelven distintas estructuras. Extraer siempre el dato mínimo necesario.

### Función que retorna JSON con envoltura `{ status, data }` (ej: `SELECT * FROM rrhh.mi_funcion($1)`)

```typescript
// La columna en rows[0] tiene el mismo nombre que la función
// rows[0] = { mi_funcion: { status: "OK", data: { ... } } }
const rows = await this.dataSource.query(
  'SELECT * FROM rrhh.mi_funcion($1)',
  [email],
);
return rows[0]?.mi_funcion?.data ?? null;
// El interceptor envuelve en { success, data: {...campos...}, ... }
```

### Función que retorna JSON compuesto (ej: `SELECT to_json(rrhh.mi_funcion($1)) AS resultado`)

```typescript
// rows[0] = { resultado: { email, solicitudes: [...] } }
const rows = await this.dataSource.query(
  'SELECT to_json(rrhh.mi_funcion($1)) AS resultado',
  [email],
);
return rows[0]?.resultado ?? { email, solicitudes: [] };
```

> **Regla**: nunca retornar `rows[0]` directo cuando la función tiene envoltura `{ status, data }`.  
> Siempre desanidar hasta llegar a los datos planos para que el `ResponseInterceptor`  
> produzca `{ success, data: { ...camposPlanos }, ... }` en vez de estructuras anidadas.

---

## Checklist al crear un endpoint

- [ ] El verbo es `@Post()` — no `@Get()`, `@Put()`, `@Patch()`, `@Delete()`
- [ ] Los datos vienen de `@Body()` — no de `@Param()` ni `@Query()`
- [ ] El prefijo de ruta es corto (ver tabla de prefijos)
- [ ] El controlador tiene `@UseGuards(JwtAuthGuard, PermisosGuard)`
- [ ] El endpoint tiene `@RequierePermiso('modulo.recurso.accion')`
- [ ] El DTO tiene decoradores `class-validator` en todas las propiedades
- [ ] El DTO tiene `@ApiProperty()` para Swagger
- [ ] El controlador solo llama al servicio — sin lógica de negocio
- [ ] No se retorna el campo `contrasena` en ninguna respuesta
- [ ] `@ApiTags()` y `@ApiBearerAuth()` están en el controlador
