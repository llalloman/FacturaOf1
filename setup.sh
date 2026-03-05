#!/bin/bash

# Script de inicialización del Sistema de Facturación SRI
echo "=========================================="
echo "Sistema de Facturación Electrónica SRI"
echo "Inicialización del Proyecto"
echo "=========================================="
echo ""

# Verificar Python
echo "1. Verificando Python..."
python --version
if [ $? -ne 0 ]; then
    echo "Error: Python no está instalado"
    exit 1
fi
echo "✓ Python instalado"
echo ""

# Crear entorno virtual
echo "2. Creando entorno virtual..."
if [ ! -d "venv" ]; then
    python -m venv venv
    echo "✓ Entorno virtual creado"
else
    echo "✓ Entorno virtual ya existe"
fi
echo ""

# Activar entorno virtual
echo "3. Activando entorno virtual..."
source venv/bin/activate
echo "✓ Entorno virtual activado"
echo ""

# Instalar dependencias
echo "4. Instalando dependencias..."
pip install --upgrade pip
pip install -r requirements.txt
echo "✓ Dependencias instaladas"
echo ""

# Crear archivo .env si no existe
echo "5. Configurando variables de entorno..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✓ Archivo .env creado desde .env.example"
    echo "⚠️  Por favor edita el archivo .env con tus configuraciones"
else
    echo "✓ Archivo .env ya existe"
fi
echo ""

# Verificar PostgreSQL
echo "6. Verificando PostgreSQL..."
psql --version
if [ $? -ne 0 ]; then
    echo "⚠️  PostgreSQL no está instalado o no está en el PATH"
    echo "   Por favor instala PostgreSQL antes de continuar"
else
    echo "✓ PostgreSQL instalado"
fi
echo ""

# Verificar Redis
echo "7. Verificando Redis..."
redis-cli --version
if [ $? -ne 0 ]; then
    echo "⚠️  Redis no está instalado o no está en el PATH"
    echo "   Por favor instala Redis antes de continuar"
else
    echo "✓ Redis instalado"
fi
echo ""

# Crear directorios necesarios
echo "8. Creando directorios..."
mkdir -p media/certificados
mkdir -p media/logos
mkdir -p media/ride
mkdir -p media/pagos/comprobantes
mkdir -p staticfiles
echo "✓ Directorios creados"
echo ""

echo "=========================================="
echo "Inicialización Básica Completada"
echo "=========================================="
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Editar el archivo .env con tus configuraciones"
echo "2. Crear la base de datos PostgreSQL:"
echo "   createdb facturacion_sri"
echo ""
echo "3. Ejecutar migraciones:"
echo "   python manage.py makemigrations"
echo "   python manage.py migrate"
echo ""
echo "4. Crear superusuario:"
echo "   python manage.py createsuperuser"
echo ""
echo "5. Iniciar servicios:"
echo "   Terminal 1: python manage.py runserver"
echo "   Terminal 2: celery -A config worker -l info"
echo "   Terminal 3: celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler"
echo ""
echo "6. Acceder al admin: http://localhost:8000/admin"
echo ""
echo "=========================================="
