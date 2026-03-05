#!/bin/bash

echo "🚀 Instalación del Sistema de Facturación SRI Ecuador"
echo "======================================================"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar Python
echo -e "\n${BLUE}1. Verificando Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 no está instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python $(python3 --version) encontrado${NC}"

# Crear entorno virtual
echo -e "\n${BLUE}2. Creando entorno virtual...${NC}"
python3 -m venv venv
source venv/bin/activate
echo -e "${GREEN}✅ Entorno virtual creado${NC}"

# Instalar dependencias
echo -e "\n${BLUE}3. Instalando dependencias de Python...${NC}"
pip install --upgrade pip
pip install -r requirements.txt
echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# Configurar variables de entorno
echo -e "\n${BLUE}4. Configurando variables de entorno...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ Archivo .env creado${NC}"
    echo -e "${RED}⚠️  Por favor edita el archivo .env con tus configuraciones${NC}"
else
    echo -e "${GREEN}✅ Archivo .env ya existe${NC}"
fi

# Verificar PostgreSQL
echo -e "\n${BLUE}5. Verificando PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL no está instalado${NC}"
    echo "Instala PostgreSQL desde: https://www.postgresql.org/download/"
else
    echo -e "${GREEN}✅ PostgreSQL encontrado${NC}"
fi

# Verificar Redis
echo -e "\n${BLUE}6. Verificando Redis...${NC}"
if ! command -v redis-cli &> /dev/null; then
    echo -e "${RED}❌ Redis no está instalado${NC}"
    echo "En macOS: brew install redis"
    echo "En Ubuntu: sudo apt install redis-server"
else
    echo -e "${GREEN}✅ Redis encontrado${NC}"
fi

# Migraciones
echo -e "\n${BLUE}7. Aplicando migraciones...${NC}"
python manage.py makemigrations
python manage.py migrate
echo -e "${GREEN}✅ Migraciones aplicadas${NC}"

# Cargar datos iniciales
echo -e "\n${BLUE}8. Cargando datos iniciales...${NC}"
if [ -f fixtures/planes_suscripcion.json ]; then
    python manage.py loaddata fixtures/planes_suscripcion.json
    echo -e "${GREEN}✅ Planes de suscripción cargados${NC}"
fi

# Crear superusuario
echo -e "\n${BLUE}9. Crear superusuario (opcional)${NC}"
read -p "¿Deseas crear un superusuario ahora? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[SsYy]$ ]]; then
    python manage.py createsuperuser
fi

echo -e "\n${GREEN}======================================================"
echo -e "✅ INSTALACIÓN COMPLETADA${NC}"
echo -e "======================================================"
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Edita el archivo .env con tus configuraciones"
echo "2. Asegúrate de que PostgreSQL y Redis estén corriendo"
echo "3. Inicia el servidor Django:"
echo "   ${BLUE}python manage.py runserver${NC}"
echo ""
echo "4. En otra terminal, inicia Celery worker:"
echo "   ${BLUE}celery -A config worker -l info${NC}"
echo ""
echo "5. En otra terminal, inicia Celery beat:"
echo "   ${BLUE}celery -A config beat -l info${NC}"
echo ""
echo "6. Para instalar el cliente POS:"
echo "   ${BLUE}cd pos-client && npm install${NC}"
echo ""
echo "Accede al admin en: http://localhost:8000/admin"
echo ""
