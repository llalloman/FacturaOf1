# Guía de Inicio Rápido - Sistema de Facturación SRI Ecuador

## 🚀 Instalación Rápida (5 minutos)

### Opción A: Script Automático (Recomendado)

```bash
cd SistemasNovi
./install.sh
```

El script automáticamente:
- ✅ Crea el entorno virtual
- ✅ Instala dependencias
- ✅ Configura .env
- ✅ Aplica migraciones
- ✅ Carga datos iniciales

### Opción B: Manual

```bash
# 1. Entorno virtual
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# o en Windows: venv\Scripts\activate

# 2. Dependencias
pip install -r requirements.txt

# 3. Variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Base de datos
createdb facturacion_sri

# 5. Migraciones
python manage.py migrate

# 6. Datos iniciales
python manage.py loaddata fixtures/planes_suscripcion.json

# 7. Superusuario
python manage.py createsuperuser
```

## 🎯 Iniciar el Sistema

### Backend Django

```bash
# Terminal 1: Django
python manage.py runserver

# Terminal 2: Celery Worker
celery -A config worker -l info

# Terminal 3: Celery Beat
celery -A config beat -l info
```

### Cliente POS (opcional)

```bash
cd pos-client
npm install
npm run dev
```

## 📝 Primer Uso

### 1. Acceder al Admin
```
http://localhost:8000/admin
Usuario: (el que creaste)
```

### 2. Crear tu Primera Empresa

**Admin Panel → Empresas → Agregar Empresa**

Datos mínimos:
- RUC: 1234567890001
- Razón Social: Mi Empresa S.A.
- Nombre Comercial: Mi Empresa
- Ambiente: PRUEBAS
- Tipo Contribuyente: ESPECIAL
- Obligado a Llevar Contabilidad: Sí

**Establecimiento:**
- Código: 001
- Dirección: Tu dirección

**Punto de Emisión:**
- Código: 001
- Descripción: Matriz

### 3. Subir Certificado Digital (.p12)

En la misma pantalla de empresa:
- Archivo Certificado Digital: (seleccionar tu .p12)
- Contraseña Certificado: (tu contraseña)

**¿No tienes certificado?**
Para pruebas, el SRI proporciona certificados de prueba:
https://www.sri.gob.ec/facturacion-electronica

### 4. Crear una Suscripción

**Admin Panel → Suscripciones → Agregar Suscripción**

- Empresa: (seleccionar tu empresa)
- Plan: BÁSICO
- Fecha Inicio: Hoy
- Fecha Fin: +30 días
- Estado: ACTIVA

### 5. Crear un Usuario Vendedor

**Admin Panel → Usuarios → Agregar Usuario**

- Username: vendedor1
- Email: vendedor@empresa.com
- Rol: VENDEDOR
- Empresa: (tu empresa)
- Contraseña: (establecer contraseña)

### 6. Crear una Bodega

**Admin Panel → Inventarios → Bodegas**

- Nombre: Bodega Principal
- Código: BOD001
- Empresa: (tu empresa)
- Activa: ✓

### 7. Crear una Caja

**Admin Panel → Ventas → Cajas**

- Nombre: Caja 1
- Código: CAJ001
- Empresa: (tu empresa)
- Bodega: Bodega Principal
- Activa: ✓

### 8. Agregar Productos

**Admin Panel → Productos → Agregar Producto**

Ejemplo:
- Código: PROD001
- Código de Barras: 7890123456789
- Nombre: Producto de Prueba
- Precio: 10.00
- Costo: 5.00
- Stock Actual: 100
- Aplica IVA: ✓ (12%)
- Activo: ✓

### 9. Agregar Clientes

**Admin Panel → Clientes → Agregar Cliente**

Cliente Consumidor Final:
- RUC/Cédula: 9999999999999
- Tipo: CONSUMIDOR_FINAL
- Razón Social: CONSUMIDOR FINAL
- Empresa: (tu empresa)

Cliente Normal:
- RUC/Cédula: 0123456789001
- Tipo: RUC
- Razón Social: Cliente Ejemplo S.A.
- Email: cliente@ejemplo.com
- Dirección: Dirección del cliente

## 🖥️ Configurar el POS

1. Abrir el cliente POS
2. Primera vez te pedirá configuración:

```
ID Empresa: 1
ID Caja: 1
ID Usuario: 2  (el vendedor que creaste)
ID Bodega: 1
URL Servidor: http://localhost:8000
```

3. El POS se conectará y descargará:
   - Productos
   - Clientes
   - Configuración

## 🧪 Realizar tu Primera Venta

### Desde el POS:

1. **Buscar Producto:**
   - Escanear código de barras, o
   - Escribir código PROD001 y Enter

2. **Agregar al Carrito:**
   - Click en el producto
   - Ajustar cantidad si necesitas

3. **Seleccionar Cliente:**
   - Click en "Seleccionar Cliente"
   - Elegir "CONSUMIDOR FINAL"

4. **Procesar Pago:**
   - Click en "Cobrar F12"
   - Método: EFECTIVO
   - Monto: 10.00
   - Click "Agregar"
   - Click "Finalizar Venta"

### Desde la API:

```bash
curl -X POST http://localhost:8000/api/ventas/ventas/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "caja": 1,
    "cliente": 1,
    "detalles": [
      {
        "producto": 1,
        "codigo": "PROD001",
        "nombre": "Producto de Prueba",
        "cantidad": 2,
        "precio_unitario": 10.00,
        "descuento": 0,
        "subtotal": 20.00,
        "iva": 2.40,
        "total": 22.40
      }
    ],
    "pagos": [
      {
        "metodo_pago": "EFECTIVO",
        "monto": 22.40
      }
    ],
    "subtotal": 20.00,
    "iva": 2.40,
    "total": 22.40
  }'
```

## 📄 Generar tu Primera Factura Electrónica

```bash
curl -X POST http://localhost:8000/api/facturacion/facturas/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "empresa": 1,
    "establecimiento": 1,
    "punto_emision": 1,
    "cliente": 1,
    "detalles": [
      {
        "producto": 1,
        "descripcion": "Producto de Prueba",
        "cantidad": 1,
        "precio_unitario": 10.00,
        "descuento": 0,
        "subtotal": 10.00,
        "codigo_impuesto": "2",
        "porcentaje_iva": 12,
        "valor_iva": 1.20,
        "total": 11.20
      }
    ]
  }'
```

Esto generará automáticamente:
- ✅ Número de comprobante (001-001-000000001)
- ✅ Clave de acceso de 49 dígitos
- ✅ XML según especificaciones SRI
- ✅ Firma electrónica XMLDSig
- ✅ Envío al SRI (ambiente de pruebas)

## 🔍 Verificar Estado

### Ver facturas:
```bash
curl http://localhost:8000/api/facturacion/facturas/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Ver ventas:
```bash
curl http://localhost:8000/api/ventas/ventas/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Ver stock:
```bash
curl http://localhost:8000/api/inventarios/stock/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🆘 Solución de Problemas

### Error: "No module named 'apps'"
```bash
# Asegúrate de estar en la carpeta correcta
cd SistemasNovi
python manage.py runserver
```

### Error: PostgreSQL no conecta
```bash
# Verificar que PostgreSQL esté corriendo
pg_isready

# Verificar credenciales en .env
cat .env | grep DB_
```

### Error: Redis no conecta
```bash
# macOS
brew services start redis

# Ubuntu
sudo systemctl start redis-server

# Verificar
redis-cli ping  # debe responder PONG
```

### POS no sincroniza
1. Verificar que el servidor Django esté corriendo
2. Verificar URL en configuración del POS
3. Ver logs en consola del navegador (F12)

## 📚 Próximos Pasos

1. ✅ Realizar varias ventas de prueba
2. ✅ Probar en modo offline (apagar servidor)
3. ✅ Ver sincronización automática
4. ✅ Generar facturas electrónicas
5. ✅ Revisar reportes en el admin
6. ✅ Configurar impresora térmica
7. ✅ Pasar a ambiente de PRODUCCIÓN

## 🎓 Tutoriales Adicionales

- [Configurar Certificado Digital](docs/certificado-digital.md)
- [Personalizar Diseño de Facturas](docs/diseno-facturas.md)
- [Integrar con Contabilidad](docs/integracion-contable.md)
- [Reportes Avanzados](docs/reportes.md)

## 💬 Soporte

- Email: soporte@tuempresa.com
- Documentación: https://docs.tuempresa.com
- Issues: https://github.com/tuempresa/facturacion-sri/issues

---

**¡Listo! Ya tienes todo configurado y funcionando** 🎉
