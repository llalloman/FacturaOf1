#!/bin/bash

# Script para configurar y ejecutar migraciones en Neon PostgreSQL

echo "🚀 Configurando base de datos en Neon..."
echo ""

# Verificar que existe el archivo .env
if [ ! -f .env ]; then
    echo "❌ Error: No existe el archivo .env"
    echo "   Copia .env.example a .env y configura tus credenciales"
    exit 1
fi

# Detectar Python (python3 o python)
if command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
elif command -v python &> /dev/null; then
    PYTHON_CMD=python
else
    echo "❌ Error: Python no está instalado"
    exit 1
fi

echo "✅ Usando $PYTHON_CMD"

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    echo "📦 Activando entorno virtual..."
    source venv/bin/activate
fi

# Instalar dependencias si es necesario
echo "📦 Verificando dependencias..."
$PYTHON_CMD -m pip install -q dj-database-url psycopg2-binary

# Verificar conexión a la base de datos
echo ""
# Crear migraciones
echo "📝 Creando migraciones..."
$PYTHON_CMD manage.py makemigrations

# Aplicar migraciones
echo ""
echo "⚙️  Aplicando migraciones..."
$PYTHON_CMD manage.py migrate

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Base de datos configurada correctamente en Neon"
    echo ""
    echo "📊 Tablas creadas:"
    $PYTHON_CMD manage.py showmigrations | grep '\[X\]' | wc -l | xargs echo "   -"
    echo ""
    echo "🎯 Siguiente paso: Crear superusuario"
    echo "   $PYTHON_CMD manage.py createsuperuser"
echo "⚙️  Aplicando migraciones..."
python manage.py migrate

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Base de datos configurada correctamente en Neon"
    echo ""
    echo "📊 Tablas creadas:"
    python manage.py showmigrations | grep '\[X\]' | wc -l | xargs echo "   -"
    echo ""
    echo "🎯 Siguiente paso: Crear superusuario"
    echo "   python manage.py createsuperuser"
else
    echo ""
    echo "❌ Error al aplicar migraciones"
    exit 1
fi
