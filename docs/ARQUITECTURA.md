# Arquitectura del Sistema

Sistema de Facturación Electrónica Multi-Tenant para el SRI de Ecuador

## Visión General

Sistema diseñado con arquitectura multi-tenant (multi-empresa) que permite a múltiples empresas facturar electrónicamente desde una única instalación, con gestión de suscripciones y control automático de acceso.

## Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                               │
│                   (Frontend React/Vue)                       │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS/JWT
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     DJANGO REST API                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │Usuarios  │Empresas  │Suscrip.  │Facturac. │Productos │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │PostgreSQL Redis   Celery  │
    │Database │  │Cache  │  │Workers│
    └────────┘  └────────┘  └────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │   SRI        │
                        │ Web Services │
                        └──────────────┘
```

## Módulos del Sistema

### 1. Usuarios (`apps.usuarios`)

**Responsabilidad:** Gestión de usuarios y autenticación

**Características:**
- Modelo de usuario personalizado basado en email
- Roles jerárquicos:
  - Super Admin: Control total del sistema
  - Admin Empresa: Gestiona su empresa
  - Contador: Facturación y reportes
  - Vendedor: Solo facturación
  - Consultor: Solo lectura
- Autenticación JWT
- Permisos granulares por rol

**Modelos:**
- `Usuario`: Usuario del sistema con rol y empresa asignada

**Endpoints:**
- `POST /api/auth/login/` - Autenticación
- `POST /api/auth/refresh/` - Renovar token
- `GET /api/usuarios/me/` - Perfil del usuario
- `POST /api/usuarios/cambiar_password/` - Cambiar contraseña

### 2. Empresas (`apps.empresas`)

**Responsabilidad:** Multi-tenancy y datos de empresas

**Características:**
- Aislamiento de datos por empresa (tenant)
- Configuración independiente de certificados
- Soporte ambientes pruebas/producción
- Middleware de tenant en cada request
- Establecimientos y puntos de emisión

**Modelos:**
- `Empresa`: Datos de la empresa y configuración SRI
- `Establecimiento`: Sucursales de la empresa
- `PuntoEmision`: Puntos de venta

**Middleware:**
- `TenantMiddleware`: Inyecta empresa en cada request según usuario autenticado

### 3. Suscripciones (`apps.suscripciones`)

**Responsabilidad:** Planes, suscripciones y pagos

**Características:**
- Planes configurables con límites
- Control de uso (facturas mensuales)
- Activación/desactivación automática
- Renovación automática opcional
- Notificaciones de vencimiento
- Registro de pagos

**Modelos:**
- `PlanSuscripcion`: Definición de planes
- `Suscripcion`: Suscripción activa de una empresa
- `Pago`: Registro de pagos

**Tareas Automáticas (Celery):**
- `verificar_suscripciones_vencidas`: Diario, desactiva empresas vencidas
- `verificar_suscripciones_por_vencer`: Diario, envía notificaciones
- `enviar_notificacion_*`: Emails automáticos

### 4. Facturación (`apps.facturacion`)

**Responsabilidad:** Comprobantes electrónicos y SRI

**Características:**
- Generación de XML según esquemas SRI
- Firma electrónica XMLDSig
- Envío automático al SRI
- Consulta de autorizaciones
- Secuenciales automáticos
- Generación de RIDE (PDF)

**Modelos:**
- `ComprobanteElectronico`: Base de todos los comprobantes
- `Factura`: Factura con detalles
- `DetalleFactura`: Items de la factura
- `Secuencial`: Control de secuenciales

**Servicios:**
- `SRIService`: Integración con web services del SRI
  - `generar_clave_acceso()`: Clave de 49 dígitos
  - `generar_xml_factura()`: XML según esquema
  - `firmar_xml()`: Firma electrónica
  - `enviar_comprobante_sri()`: Envío al SRI
  - `autorizar_comprobante_sri()`: Consulta autorización

**Tareas Automáticas:**
- `verificar_autorizaciones_pendientes`: Cada 10 min
- `firmar_y_enviar_comprobante`: On-demand
- `generar_ride_pdf`: On-demand

### 5. Productos (`apps.productos`)

**Responsabilidad:** Catálogo de productos/servicios

**Características:**
- Productos y servicios
- Control de inventario opcional
- Configuración de impuestos
- Precios y costos
- Stock mínimo

**Modelos:**
- `Producto`: Producto o servicio vendible

### 6. Clientes (`apps.clientes`)

**Responsabilidad:** Base de clientes

**Características:**
- Tipos de identificación SRI
- Consumidor final
- Datos de contacto

**Modelos:**
- `Cliente`: Cliente de la empresa

### 7. Core (`apps.core`)

**Responsabilidad:** Utilidades y comandos comunes

**Características:**
- Comandos de gestión
- Fixtures de datos de prueba

**Comandos:**
- `crear_datos_prueba`: Crea empresas, usuarios, productos demo

## Flujo de Facturación

```
1. Usuario crea factura
   ↓
2. Sistema valida:
   - Suscripción activa
   - Límites de facturación
   - Datos obligatorios
   ↓
3. Genera XML según esquema SRI
   ↓
4. Calcula clave de acceso (49 dígitos)
   ↓
5. Firma electrónicamente con certificado
   ↓
6. Envía al SRI (Recepción)
   ↓
7. SRI valida y retorna "RECIBIDA"
   ↓
8. Cada 10 min consulta autorización
   ↓
9. SRI autoriza comprobante
   ↓
10. Genera RIDE (PDF)
    ↓
11. Factura AUTORIZADA lista
```

## Modelo de Datos

### Relaciones Principales

```
Usuario ─────┐
             ├──> Empresa ────> Suscripcion ───> PlanSuscripcion
             │       │
             │       ├──> Cliente
             │       ├──> Producto
             │       └──> ComprobanteElectronico ───> Factura ───> DetalleFactura
             │                                            │
             └────────────────────────────────────────────┘
                            (usuario_creador)
```

### Multi-Tenancy

- Cada empresa es un tenant independiente
- Datos aislados por empresa
- Usuario vinculado a una empresa
- Middleware inyecta tenant en cada request
- Super Admin puede acceder a todas las empresas

## Seguridad

### Autenticación

- JWT (JSON Web Tokens)
- Tokens de acceso: 60 minutos
- Tokens de refresh: 7 días
- Rotación de tokens al renovar

### Autorización

- Permisos basados en roles
- Validación de acceso a empresa
- Endpoints protegidos por decoradores
- Middleware de tenant valida acceso

### Firma Electrónica

- Certificados PKCS#12 (.p12)
- Contraseñas encriptadas en BD
- Validación de vigencia
- XMLDSig estándar

## Escalabilidad

### Horizontal

- Stateless API (JWT)
- Celery distribuido con Redis
- PostgreSQL con réplicas
- Load balancer para múltiples instancias Django

### Vertical

- Índices en BD para queries frecuentes
- Cache con Redis
- Optimización de queries (select_related, prefetch_related)
- Paginación en APIs

### Límites

- Configurables por plan de suscripción
- Control de facturas mensuales
- Límite de usuarios por empresa
- Límite de empresas por cliente

## Monitoreo y Logs

### Logs

```python
# Django logs
- Request/Response
- Errores de aplicación
- Queries SQL (en DEBUG)

# Celery logs
- Tareas ejecutadas
- Errores en workers
- Tiempos de ejecución

# SRI Integration logs
- XMLs generados
- Respuestas del SRI
- Errores de autorización
```

### Métricas Importantes

- Facturas emitidas por empresa
- Tasa de autorización SRI
- Tiempo de respuesta SRI
- Uso de suscripciones
- Usuarios activos

## Despliegue

### Desarrollo

```bash
# Django
python manage.py runserver

# Celery Worker
celery -A config worker -l info

# Celery Beat
celery -A config beat -l info
```

### Producción

```bash
# Servidor WSGI (Gunicorn)
gunicorn config.wsgi:application --bind 0.0.0.0:8000

# Nginx como reverse proxy
# Supervisor para gestión de procesos
# Systemd para servicios de Celery
```

### Contenedores (Docker)

```yaml
services:
  - web (Django + Gunicorn)
  - postgres
  - redis
  - celery_worker
  - celery_beat
  - nginx
```

## Mantenimiento

### Backups

- PostgreSQL: pg_dump diario
- Media files: rsync a storage remoto
- Certificados: backup encriptado
- XMLs autorizados: obligatorio 7 años

### Actualizaciones

- Migraciones de BD con Django migrations
- Zero-downtime deployment con blue-green
- Rollback plan en caso de errores

### Monitoreo

- Health checks de servicios
- Alertas de certificados por vencer
- Monitoreo de suscripciones
- Logs centralizados (ELK stack recomendado)

## Tecnologías

- **Backend:** Django 5.0, DRF 3.14
- **Base de Datos:** PostgreSQL 12+
- **Cache/Queue:** Redis 6+
- **Tasks:** Celery 5.3
- **Firma Electrónica:** signxml, cryptography
- **SOAP Client:** zeep
- **XML:** lxml
- **PDF:** ReportLab
- **Auth:** JWT (simplejwt)

## Cumplimiento SRI

- ✅ Esquemas XSD oficiales
- ✅ Clave de acceso con módulo 11
- ✅ Firma electrónica XMLDSig
- ✅ Web Services SOAP
- ✅ Ambiente pruebas/producción
- ✅ Almacenamiento de XMLs autorizados
- ✅ Generación de RIDE

## Mejoras Futuras

- [ ] API GraphQL
- [ ] Notificaciones en tiempo real (WebSockets)
- [ ] Reportes avanzados con Analytics
- [ ] Exportación a formatos contables
- [ ] Integración con bancos
- [ ] App móvil
- [ ] Facturación recurrente
- [ ] Punto de venta (POS)

---

**Versión:** 1.0.0  
**Actualizado:** 27 de enero de 2026
