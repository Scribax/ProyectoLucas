#!/bin/bash

# Script de backup para Granja Avícola PWA
# Uso: ./backup.sh [nombre_opcional]

set -e

# Configuración
BACKUP_DIR="/opt/granja-avicola/backups"
COMPOSE_FILE="/opt/granja-avicola/docker-compose.yml"
DB_CONTAINER="granja-db"
RETENTION_DAYS=30

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Timestamp
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="${1:-granja_$TIMESTAMP}"
BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Iniciando backup de Granja Avícola...${NC}"
echo "Fecha: $(date)"
echo "Archivo: $BACKUP_FILE"

# Verificar que el contenedor existe
if ! docker ps -q -f name=$DB_CONTAINER | grep -q .; then
    echo -e "${RED}❌ Error: Contenedor $DB_CONTAINER no está corriendo${NC}"
    exit 1
fi

# Detectar credenciales desde el contenedor (compatibles con docker-compose)
DB_NAME="$(docker exec $DB_CONTAINER printenv POSTGRES_DB 2>/dev/null || true)"
DB_USER="$(docker exec $DB_CONTAINER printenv POSTGRES_USER 2>/dev/null || true)"
DB_NAME="${DB_NAME:-granja_avicola}"
DB_USER="${DB_USER:-postgres}"

# Ejecutar backup
echo -e "${YELLOW}💾 Exportando base de datos...${NC}"
if docker exec $DB_CONTAINER pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"; then
    # Comprimir
    echo -e "${YELLOW}🗜️  Comprimiendo...${NC}"
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    # Mostrar tamaño
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup completado exitosamente!${NC}"
    echo "Archivo: $BACKUP_FILE"
    echo "Tamaño: $SIZE"
else
    echo -e "${RED}❌ Error durante el backup${NC}"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Backup de facturas (imágenes generadas)
echo -e "${YELLOW}📄 Respaldando facturas...${NC}"
INVOICE_BACKUP="$BACKUP_DIR/invoices_$TIMESTAMP.tar.gz"
if [ -d "/opt/granja-avicola/invoices" ]; then
    tar -czf "$INVOICE_BACKUP" -C /opt/granja-avicola invoices 2>/dev/null || true
    echo -e "${GREEN}✅ Facturas respaldadas${NC}"
fi

# Limpiar backups antiguos
echo -e "${YELLOW}🧹 Limpiando backups antiguos (> $RETENTION_DAYS días)...${NC}"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "invoices_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo -e "${GREEN}🎉 Backup finalizado!${NC}"
echo "Ubicación: $BACKUP_FILE"

# Listar últimos 5 backups
echo -e "\n${YELLOW}📋 Últimos backups:${NC}"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5 | awk '{print $9, "(" $5 ")"}'
