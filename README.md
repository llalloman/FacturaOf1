# Sistema de Facturación Electrónica Multi-Tenant SRI Ecuador

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
