#!/bin/bash

# Script de restore para Granja Avícola PWA
# Uso: ./restore.sh <archivo_backup.sql.gz>

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar argumento
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: Debes especificar el archivo de backup${NC}"
    echo "Uso: $0 <archivo_backup.sql.gz>"
    echo ""
    echo "Backups disponibles:"
    ls -1 /opt/granja-avicola/backups/*.sql.gz 2>/dev/null || echo "No hay backups disponibles"
    exit 1
fi

BACKUP_FILE="$1"
COMPOSE_FILE="/opt/granja-avicola/docker-compose.yml"
DB_CONTAINER="granja-db"
DB_NAME="granja_avicola"
DB_USER="postgres"

# Verificar que el archivo existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Archivo no encontrado: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  RESTAURACIÓN DE BASE DE DATOS${NC}"
echo -e "${RED}⚠️  ESTA ACCIÓN ELIMINARÁ TODOS LOS DATOS ACTUALES${NC}"
echo ""
echo "Archivo: $BACKUP_FILE"
echo "Tamaño: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

# Confirmación
read -p "¿Estás seguro? Escribe 'SI' para continuar: " confirm
if [ "$confirm" != "SI" ]; then
    echo -e "${YELLOW}❌ Cancelado por el usuario${NC}"
    exit 0
fi

# Verificar que el contenedor está corriendo
if ! docker ps -q -f name=$DB_CONTAINER | grep -q .; then
    echo -e "${YELLOW}🔄 Iniciando contenedor de base de datos...${NC}"
    cd /opt/granja-avicola && docker compose up -d db
    sleep 5
fi

echo -e "${YELLOW}🔄 Restaurando base de datos...${NC}"

# Crear backup de seguridad antes de restaurar
SAFETY_BACKUP="/opt/granja-avicola/backups/pre_restore_$(date +%Y-%m-%d_%H-%M-%S).sql"
echo -e "${BLUE}💾 Creando backup de seguridad...${NC}"
docker exec $DB_CONTAINER pg_dump -U $DB_USER $DB_NAME > "$SAFETY_BACKUP" || true

# Descomprimir si es necesario
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo -e "${BLUE}🗜️  Descomprimiendo backup...${NC}"
    gunzip -c "$BACKUP_FILE" | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
else
    cat "$BACKUP_FILE" | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
fi

echo -e "${GREEN}✅ Restauración completada exitosamente!${NC}"

# Reiniciar servicios
echo -e "${YELLOW}🔄 Reiniciando servicios...${NC}"
cd /opt/granja-avicola && docker compose restart backend frontend

echo -e "${GREEN}🎉 Sistema restaurado y listo!${NC}"
echo "Accede a: http://localhost"
