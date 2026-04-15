# Sistema de Facturación Electrónica — SRI Ecuador

> **Stack**: Django 4.2 · Django REST Framework · Celery + Redis · PostgreSQL · React 19 + Vite · TailwindCSS

---

## Inicio rápido en desarrollo

### Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| PostgreSQL | 12+ |
| Redis | 6+ |

---

### 1. Variables de entorno

```bash
# Raíz del proyecto → archivo .env
SECRET_KEY=cambia-esto-por-un-valor-seguro
DEBUG=True
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/facturacion_sri
REDIS_URL=redis://localhost:6379/0
SRI_AMBIENTE=PRUEBAS          # PRUEBAS | PRODUCCION

# Email (opcional en desarrollo, usa consola por defecto)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend

# JWT
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
```

> Copia `gcp-back.env.example` como punto de partida para producción.

---

### 2. Backend (Django)

```bash
# 1. Crear y activar entorno virtual
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Aplicar migraciones
python manage.py migrate

# 4. Cargar datos iniciales (planes de suscripción)
python manage.py loaddata fixtures/planes_suscripcion.json

# 5. Crear superusuario (primera vez)
python manage.py createsuperuser
```

Levantar los servicios (3 terminales independientes):

```bash
# Terminal 1 — API Django
python manage.py runserver 8000

# Terminal 2 — Celery Worker (procesa tareas asíncronas)
celery -A config worker -l info

# Terminal 3 — Celery Beat (cron de tareas periódicas)
celery -A config beat -l info
```

> La API queda disponible en: **http://127.0.0.1:8000/api/**
> Admin Django: **http://127.0.0.1:8000/admin/**

---

### 3. Frontend (React + Vite)

```bash
cd web-admin
npm install       # solo la primera vez
npm run dev
```

> Queda disponible en: **http://localhost:5174/**

La URL del backend se configura con la variable de entorno:

```bash
# web-admin/.env.local  (crear si no existe)
VITE_API_URL=http://localhost:8000/api
```

Sin ese archivo, Vite usa `http://localhost:8000/api` como fallback automático.

---

## Tareas periódicas (Celery Beat)

| Tarea | Frecuencia | Descripción |
|---|---|---|
| `verificar_autorizaciones_pendientes` | cada 2 min | Consulta al SRI el estado de comprobantes en estado `ENVIADO` |
| `reintentar_comprobantes_fallidos` | cada 10 min | Reintenta `BORRADOR`, `RECHAZADO` y `NO_AUTORIZADO` en orden de secuencial |
| `verificar_suscripciones_vencidas` | 00:00 diario | Desactiva suscripciones expiradas |
| `verificar_suscripciones_por_vencer` | 09:00 diario | Envía alertas de vencimiento próximo |

> **Importante**: sin Celery Worker y Beat corriendo, las facturas no se re-envían automáticamente al SRI y las suscripciones no se actualizan.

---

## Envío de facturas al SRI — flujo y estados

```
Nueva venta
  └─ crear_factura_desde_venta()
        ├─ Secuencial asignado (atómico con select_for_update)
        ├─ ComprobanteElectronico creado en estado BORRADOR
        └─ procesar_factura_sri()
              ├─ Sin certificado digital    → queda en BORRADOR (mensaje visible en UI)
              ├─ Error de redondeo fiscal   → queda en BORRADOR (mensaje visible en UI)
              ├─ Firma + envío OK           → FIRMADO → ENVIADO
              ├─ SRI autoriza               → AUTORIZADO ✓
              └─ SRI rechaza               → RECHAZADO / NO_AUTORIZADO
                                                └─ Celery lo reintenta en orden cada 10 min
```

### Estados posibles

| Estado | Descripción |
|---|---|
| `BORRADOR` | Creado pero no enviado. Ver `mensajes_sri` para el motivo exacto. |
| `FIRMADO` | XML generado y firmado, pendiente de envío |
| `ENVIADO` | Recibido por el SRI, esperando autorización |
| `AUTORIZADO` | Autorizado por el SRI. Número de autorización disponible. |
| `RECHAZADO` | SRI rechazó la recepción (error en datos) |
| `NO_AUTORIZADO` | SRI recibió pero denegó la autorización |
| `ANULADO` | Anulado mediante Nota de Crédito |

### Cola ordenada por secuencial

El cron de reintento garantiza que si una factura queda bloqueada (BORRADOR/RECHAZADO), las siguientes del mismo punto de emisión **no se procesan** hasta que la anterior se resuelva, evitando saltos de secuencial en el SRI.

---

## Configuración del certificado digital

1. Ir a **Configuración → Firma Digital** en la interfaz web
2. Subir el archivo `.p12` de la empresa
3. Ingresar la contraseña del certificado
4. El sistema firma automáticamente todos los comprobantes desde ese momento

> Sin certificado: los comprobantes se generan en XML pero quedan en `BORRADOR`. Se enviarán automáticamente en cuanto se configure el certificado (el cron los reintentará).

---

## Ambiente SRI

| Variable `SRI_AMBIENTE` | Endpoints |
|---|---|
| `PRUEBAS` | `https://celarium.sri.gob.ec/...` |
| `PRODUCCION` | `https://sri.gob.ec/...` |

Cambiar el valor en `.env` y reiniciar Django. No requiere cambios de código.

---

## Estructura del proyecto

```
FacturaOf1/
├── config/              # Settings, Celery, URLs raíz
├── apps/
│   ├── facturacion/     # Comprobantes, facturas, NC, ND, retenciones, guías
│   │   ├── models.py    # ComprobanteElectronico, Factura, Secuencial…
│   │   ├── tasks.py     # Celery: verificar autorizaciones, reintentar fallidos
│   │   ├── views.py     # ViewSets REST
│   │   └── services/    # factura_service, sri_service, ride_service…
│   ├── ventas/          # POS y ventas
│   ├── productos/       # Catálogo
│   ├── clientes/        # Clientes
│   ├── proveedores/     # Proveedores y órdenes de compra
│   ├── inventarios/     # Bodegas y movimientos
│   ├── empresas/        # Multi-tenant, configuración de empresa
│   ├── usuarios/        # Auth JWT, roles
│   └── suscripciones/   # Planes y límites de facturación
├── web-admin/           # Frontend React + Vite (panel administrativo)
│   └── src/
│       ├── pages/       # Una carpeta por módulo (facturas, ventas, clientes…)
│       ├── services/    # Clientes Axios por módulo
│       ├── types/       # Interfaces TypeScript
│       └── store/       # Zustand + toast/confirm helpers
├── pos-client/          # Cliente POS (Electron/React, opcional)
├── fixtures/            # Datos iniciales
├── requirements.txt
└── manage.py
```

---

## Licencia

Propietario — Todos los derechos reservados.  
Desarrollado para Ecuador.

---


Sistema completo de facturación electrónica homologado para el SRI de Ecuador con arquitectura multi-tenant (multi-empresa) y gestión de suscripciones.

## Características Principales

### 🏢 Multi-Tenant (Multi-Empresa)
- Gestión de múltiples empresas desde una sola instalación
- Aislamiento de datos por empresa
- Configuración independiente para cada empresa
- Soporte para ambientes de pruebas y producción

### 💳 Gestión de Suscripciones
- Planes de suscripción configurables
- Control de límites de facturación por plan
- Activación/desactivación automática según estado de suscripción
- Notificaciones de vencimiento y renovación
- Renovación automática de suscripciones
- Registro de pagos

### 📄 Facturación Electrónica SRI
- Generación de XML según esquemas del SRI
- Firma electrónica de comprobantes (XMLDSig)
- Envío automático al SRI
- Verificación de autorizaciones
- Generación de RIDE (PDF)
- Soporte para:
  - Facturas
  - Notas de Crédito
  - Notas de Débito
  - Guías de Remisión
  - Comprobantes de Retención

### 👥 Control de Usuarios y Permisos
- Roles: Super Admin, Admin Empresa, Contador, Vendedor, Consultor
- Autenticación JWT
- Permisos granulares por rol
- Multi-usuario por empresa

### 📊 Gestión Completa
- Clientes
- **Proveedores**
- Productos/Servicios
- **Inventario con bodegas y movimientos**
- **Órdenes de Compra**
- **Recepciones de Compra**
- **Cuentas por Pagar**
- **Ventas y Punto de Venta (POS)**
- **Cierres de Caja**
- Establecimientos y puntos de emisión
- Secuenciales automáticos

## Tecnologías Utilizadas

- **Backend**: Django 5.0 + Django REST Framework
- **Base de Datos**: PostgreSQL
- **Tareas Asíncronas**: Celery + Redis
- **Firma Electrónica**: signxml, cryptography
- **Integración SRI**: zeep (SOAP), lxml
- **PDF Generation**: ReportLab
- **Autenticación**: JWT (djangorestframework-simplejwt)

## Requisitos Previos

- Python 3.10+
- PostgreSQL 12+
- Redis 6+

## Instalación

### 1. Clonar el repositorio
```bash
cd SistemasNovi
```

### 2. Crear entorno virtual
```bash
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

### 5. Crear base de datos PostgreSQL
```bash
createdb facturacion_sri
```

### 6. Ejecutar migraciones
```bash
python manage.py makemigrations
python manage.py migrate
```

### 7. Crear superusuario
```bash
python manage.py createsuperuser
```

### 8. Iniciar servicios

**Terminal 1 - Django**:
```bash
python manage.py runserver
```

**Terminal 2 - Celery Worker**:
```bash
celery -A config worker -l info
```

**Terminal 3 - Celery Beat (tareas programadas)**:
```bash
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

## Configuración Inicial

### 1. Crear Planes de Suscripción

Accede al admin de Django (http://localhost:8000/admin) y crea los planes:

```python
# Ejemplo: Plan Básico
- Nombre: Plan Básico Mensual
- Código: BASICO_MENSUAL
- Tipo: BASICO
- Periodo: MENSUAL
- Precio: 29.99
- Facturas mensuales: 100
- Usuarios permitidos: 2
- Empresas permitidas: 1
```

### 2. Registrar una Empresa

```python
# Desde el admin o API
- RUC: 1234567890001
- Razón Social: Mi Empresa SAS
- Ambiente: PRUEBAS (inicialmente)
- Certificado Digital: Subir archivo .p12
- Password del certificado: *****
```

### 3. Crear Suscripción

Asigna un plan a la empresa para activarla.

## Uso del API

### Autenticación

**Login**:
```bash
POST /api/auth/login/
{
  "email": "usuario@empresa.com",
  "password": "password123"
}

Response:
{
  "access": "eyJ0eXAiOiJKV1QiLCJh...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJh...",
  "usuario": {
    "id": 1,
    "email": "usuario@empresa.com",
    "nombre_completo": "Juan Pérez",
    "rol": "ADMIN_EMPRESA",
    "empresa_id": 1
  }
}
```

Incluir token en headers:
```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJh...
```

### Crear Cliente

```bash
POST /api/clientes/
{
  "tipo_identificacion": "05",
  "identificacion": "1234567890",
  "razon_social": "Cliente Demo",
  "email": "cliente@demo.com",
  "telefono": "0999999999",
  "direccion": "Quito, Ecuador"
}
```

### Crear Producto

```bash
POST /api/productos/
{
  "codigo_principal": "PROD001",
  "nombre": "Producto de Prueba",
  "descripcion": "Descripción del producto",
  "precio": 100.00,
  "aplica_iva": true,
  "porcentaje_iva": "2"
}
```

### Crear Factura

```bash
POST /api/facturacion/facturas/
{
  "cliente_id": 1,
  "fecha_emision": "2026-01-27T10:00:00",
  "forma_pago": "20",
  "detalles": [
    {
      "producto_id": 1,
      "cantidad": 2,
      "precio_unitario": 100.00,
      "descuento": 0.00
    }
  ],
  "observaciones": "Factura de prueba"
}
```

## Ambiente de Pruebas SRI

### Certificado de Pruebas

1. Solicitar certificado de pruebas al SRI
2. Descargar archivo .p12
3. Configurar en la empresa

### URLs de Prueba

Ya configuradas en el sistema:
- Recepción: `https://celarium.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl`
- Autorización: `https://celarium.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl`

### Proceso de Homologación

1. Emitir comprobantes en ambiente de pruebas
2. Verificar autorizaciones exitosas
3. Documentar resultados
4. Solicitar homologación al SRI
5. Una vez aprobado, cambiar a ambiente de producción

## Migración a Producción

1. Obtener certificado digital de producción
2. Cambiar ambiente de empresa a "PRODUCCION"
3. Actualizar certificado digital
4. Verificar secuenciales
5. Realizar pruebas

## Tareas Automáticas

El sistema ejecuta automáticamente:

- **Diariamente a las 00:00**: Verificar suscripciones vencidas
- **Diariamente a las 09:00**: Notificar suscripciones por vencer
- **Cada 10 minutos**: Verificar autorizaciones pendientes del SRI

## Estructura del Proyecto

```
SistemasNovi/
├── config/                 # Configuración Django
│   ├── settings.py
│   ├── urls.py
│   ├── celery.py
│   └── wsgi.py
├── apps/
│   ├── usuarios/          # Gestión de usuarios
│   ├── empresas/          # Multi-tenant
│   ├── suscripciones/     # Planes y suscripciones
│   ├── facturacion/       # Comprobantes electrónicos
│   ├── productos/         # Productos/servicios
│   ├── clientes/          # Clientes
│   ├── proveedores/       # Proveedores y compras
│   ├── inventarios/       # Control de inventarios
│   └── ventas/            # POS y ventas
├── media/                 # Archivos subidos
├── staticfiles/          # Archivos estáticos
├── requirements.txt
├── manage.py
└── README.md
```

## Soporte

Para soporte técnico o consultas sobre homologación SRI, contactar al equipo de desarrollo.

## Licencia

Propietario - Todos los derechos reservados

---

**Desarrollado con ❤️ para Ecuador**
