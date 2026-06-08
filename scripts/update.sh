#!/bin/bash

# Script de actualización para Granja Avícola PWA
# Actualiza la aplicación manteniendo los datos

set -e

COMPOSE_DIR="/opt/granja-avicola"
BACKUP_DIR="$COMPOSE_DIR/backups"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 Actualización de Granja Avícola${NC}"
echo "================================"
echo ""

# 1. Backup de seguridad
echo -e "${YELLOW}📦 Paso 1: Creando backup de seguridad...${NC}"
$COMPOSE_DIR/scripts/backup.sh pre_update_$(date +%Y%m%d)

# 2. Pull de cambios (si es repo git)
if [ -d "$COMPOSE_DIR/.git" ]; then
    echo -e "${YELLOW}📥 Paso 2: Descargando actualizaciones...${NC}"
    cd $COMPOSE_DIR
    git pull origin main || git pull origin master || echo "No hay cambios nuevos"
fi

# 3. Detener servicios (excepto DB)
echo -e "${YELLOW}🛑 Paso 3: Deteniendo servicios...${NC}"
cd $COMPOSE_DIR
docker compose stop backend frontend nginx

# 4. Rebuild
echo -e "${YELLOW}🔨 Paso 4: Reconstruyendo imágenes...${NC}"
docker compose build --no-cache backend frontend nginx

# 5. Actualizar dependencias de DB si hay nuevas migraciones
echo -e "${YELLOW}💾 Paso 5: Verificando base de datos...${NC}"
docker compose up -d postgres
sleep 3

# 6. Iniciar todo
echo -e "${YELLOW}🚀 Paso 6: Iniciando servicios...${NC}"
docker compose up -d

# 7. Health check
echo -e "${YELLOW}🏥 Paso 7: Verificando servicios...${NC}"
sleep 5

if curl -s http://localhost/health > /dev/null; then
    echo -e "${GREEN}✅ Sistema funcionando correctamente${NC}"
else
    echo -e "${RED}⚠️  Posible problema, verificar logs:${NC}"
    echo "docker compose logs -f"
fi

echo ""
echo -e "${GREEN}🎉 Actualización completada!${NC}"
echo "Fecha: $(date)"
echo ""
echo "Para ver logs: docker compose logs -f"
echo "Para rollback: $COMPOSE_DIR/scripts/restore.sh <backup_pre_update>"
