# Guía de Inicio Rápido

Esta guía te ayudará a poner en marcha el sistema de facturación electrónica en pocos minutos.

## Prerrequisitos

- Python 3.10 o superior
- PostgreSQL 12 o superior
- Redis 6 o superior
- Git

## Instalación Rápida

### 1. Clonar y configurar

```bash
cd SistemasNovi
chmod +x setup.sh
./setup.sh
```

Este script:
- Crea entorno virtual
- Instala dependencias
- Crea archivo .env
- Crea directorios necesarios

### 2. Configurar base de datos

```bash
# Crear base de datos
createdb facturacion_sri

# Editar .env con tus credenciales
nano .env

# Configurar:
DB_NAME=facturacion_sri
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432
```

### 3. Ejecutar migraciones

```bash
source venv/bin/activate
python manage.py makemigrations
python manage.py migrate
```

### 4. Crear superusuario

```bash
python manage.py createsuperuser
```

Ingresa:
- Email: admin@sistema.com
- Nombre: Admin
- Apellido: Sistema
- Password: (tu password seguro)

### 5. Crear datos de prueba (Opcional)

```bash
python manage.py crear_datos_prueba
```

Esto crea:
- 3 planes de suscripción
- 1 empresa demo
- 3 usuarios (admin, contador, vendedor)
- 3 clientes
- 3 productos

### 6. Iniciar servicios

**Terminal 1 - Django:**
```bash
python manage.py runserver
```

**Terminal 2 - Celery Worker:**
```bash
celery -A config worker -l info
```

**Terminal 3 - Celery Beat:**
```bash
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

**Terminal 4 - Redis (si no está corriendo):**
```bash
redis-server
```

## Acceso al Sistema

### Admin Panel
```
URL: http://localhost:8000/admin
Email: admin@sistema.com
Password: [tu password]
```

### API Endpoints

Base URL: `http://localhost:8000/api/`

#### Autenticación

**Login:**
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@empresa.com",
    "password": "admin123"
  }'
```

Respuesta:
```json
{
  "access": "eyJ0eXAiOiJKV1QiLC...",
  "refresh": "eyJ0eXAiOiJKV1QiLC...",
  "usuario": {
    "id": 1,
    "email": "admin@empresa.com",
    "nombre_completo": "Admin Empresa",
    "rol": "ADMIN_EMPRESA",
    "empresa_id": 1
  }
}
```

## Configuración Inicial

### 1. Crear Plan de Suscripción

En el admin, ir a **Suscripciones > Planes de suscripción**

```
Nombre: Plan Básico Mensual
Código: BASICO_MENSUAL
Tipo: BASICO
Periodo: MENSUAL
Precio: 29.99
Facturas mensuales: 100
Usuarios permitidos: 2
```

### 2. Crear Empresa

En el admin, ir a **Empresas > Empresas**

```
RUC: 1234567890001
Razón Social: MI EMPRESA SAS
Nombre Comercial: Mi Empresa
Tipo: SOCIEDAD
Obligado Contabilidad: Sí
Dirección: Av. Principal 123, Quito
Teléfono: 022345678
Email: info@miempresa.com
Ambiente: PRUEBAS
```

**IMPORTANTE:** Subir certificado digital (.p12) y contraseña

### 3. Crear Suscripción

En el admin, ir a **Suscripciones > Suscripciones**

```
Empresa: [Seleccionar empresa creada]
Plan: Plan Básico Mensual
Estado: ACTIVA
Auto renovar: Sí
```

### 4. Crear Usuario

En el admin, ir a **Usuarios > Usuarios**

```
Email: usuario@miempresa.com
Nombre: Juan
Apellido: Pérez
Rol: ADMIN_EMPRESA
Empresa: [Seleccionar empresa]
Password: [contraseña segura]
```

## Primeros Pasos con API

### Obtener Token

```bash
export TOKEN="eyJ0eXAiOiJKV1QiLC..."
```

### Listar Usuarios

```bash
curl http://localhost:8000/api/usuarios/ \
  -H "Authorization: Bearer $TOKEN"
```

### Crear Cliente

```bash
curl -X POST http://localhost:8000/api/clientes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo_identificacion": "05",
    "identificacion": "1234567890",
    "razon_social": "Juan Pérez",
    "email": "juan@email.com",
    "telefono": "0991234567",
    "direccion": "Quito, Ecuador"
  }'
```

### Crear Producto

```bash
curl -X POST http://localhost:8000/api/productos/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_principal": "PROD001",
    "nombre": "Laptop HP",
    "descripcion": "Laptop HP 15 pulgadas",
    "tipo": "BIEN",
    "precio": 850.00,
    "aplica_iva": true,
    "porcentaje_iva": "2"
  }'
```

### Crear Factura

```bash
curl -X POST http://localhost:8000/api/facturacion/facturas/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": 1,
    "fecha_emision": "2026-01-27T10:00:00",
    "forma_pago": "20",
    "detalles": [
      {
        "producto_id": 1,
        "cantidad": 1,
        "precio_unitario": 850.00,
        "descuento": 0.00
      }
    ]
  }'
```

## Verificar Funcionamiento

### 1. Verificar Redis

```bash
redis-cli ping
# Debe retornar: PONG
```

### 2. Verificar Celery

```bash
# En el terminal de Celery Worker deberías ver:
[tasks]
  . apps.facturacion.tasks.firmar_y_enviar_comprobante
  . apps.facturacion.tasks.verificar_autorizaciones_pendientes
  . apps.suscripciones.tasks.verificar_suscripciones_vencidas
```

### 3. Verificar Base de Datos

```bash
python manage.py dbshell
\dt  # Listar tablas
# Deberías ver todas las tablas creadas
```

## Pruebas de Facturación

### 1. Ambiente de Pruebas

- Asegúrate de tener certificado de pruebas del SRI
- Empresa configurada con Ambiente = PRUEBAS
- Suscripción activa

### 2. Emitir Primera Factura

1. Crear cliente (Consumidor Final para pruebas)
2. Crear producto con IVA 12%
3. Crear factura desde API o admin
4. Sistema automáticamente:
   - Genera XML
   - Firma electrónicamente
   - Envía al SRI
   - Espera autorización (cada 10 min)

### 3. Verificar Autorización

```bash
# Revisar logs de Celery
# O consultar en el admin el estado del comprobante
```

## Troubleshooting

### Error: "No module named 'apps'"

```bash
# Asegúrate de estar en el directorio correcto
cd SistemasNovi
python manage.py runserver
```

### Error: "could not connect to server: Connection refused"

```bash
# PostgreSQL no está corriendo
# En macOS:
brew services start postgresql

# En Linux:
sudo service postgresql start
```

### Error: "Error 111 connecting to localhost:6379"

```bash
# Redis no está corriendo
# En macOS:
brew services start redis

# En Linux:
sudo service redis-server start
```

### Error al firmar XML

```bash
# Verificar:
# 1. Certificado .p12 subido correctamente
# 2. Password del certificado correcto
# 3. Certificado no vencido
```

## Próximos Pasos

1. **Configurar Email** (opcional)
   - Editar .env con credenciales SMTP
   - Habilita notificaciones automáticas

2. **Personalizar Planes**
   - Ajustar precios y límites
   - Crear planes anuales con descuento

3. **Importar Datos**
   - Usar fixtures para cargar datos masivos
   - Importar productos desde CSV/Excel

4. **Homologación SRI**
   - Revisar guía HOMOLOGACION_SRI.md
   - Emitir set de pruebas
   - Solicitar homologación

5. **Frontend**
   - Conectar aplicación React/Vue/Angular
   - Usar tokens JWT para autenticación

## Recursos

- **Documentación API:** http://localhost:8000/api/ (con DRF browsable API)
- **Admin Panel:** http://localhost:8000/admin
- **Swagger/OpenAPI:** (próximamente)

## Soporte

Para preguntas o problemas:
- Revisar logs: `python manage.py runserver` y terminales de Celery
- Verificar configuración en .env
- Consultar documentación del SRI

---

¡Listo! Tu sistema de facturación electrónica está funcionando. 🎉
