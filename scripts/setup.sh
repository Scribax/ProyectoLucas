#!/bin/bash

# Script de PRIMER DESPLIEGUE para Granja Avícola PWA
# Úsalo UNA sola vez en un VPS nuevo. Para actualizaciones posteriores usa update.sh.
#
# Qué hace:
#   1. Verifica que Docker y Docker Compose estén instalados.
#   2. Crea los directorios necesarios (backups, invoices, ssl).
#   3. Levanta primero la base de datos y espera a que esté lista.
#   4. Construye y levanta backend, frontend y nginx.
#   5. Hace un health check.
#
# IMPORTANTE sobre la base de datos:
#   NO hay que correr ningún SQL a mano. Al arrancar, el backend ejecuta
#   ensureSchema(), que aplica todas las migraciones de forma idempotente,
#   elimina los triggers viejos de saldo y RECALCULA todos los saldos.
#   init.sql solo corre la primera vez que se crea el volumen de Postgres.

set -e

# Directorio del proyecto = carpeta padre de este script (sirve en cualquier ruta).
COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Primer despliegue de Granja Avícola${NC}"
echo "======================================"
echo "Directorio: $COMPOSE_DIR"
echo ""

cd "$COMPOSE_DIR"

# 1. Verificar Docker
echo -e "${YELLOW}🔍 Paso 1: Verificando Docker...${NC}"
if ! command -v docker > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker no está instalado. Seguí el Paso 2 de DEPLOY.md.${NC}"
    exit 1
fi
if ! docker compose version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose v2 no está disponible.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker $(docker --version) OK${NC}"

# 2. Crear directorios necesarios
echo -e "${YELLOW}📁 Paso 2: Creando directorios...${NC}"
mkdir -p backups backups/invoices invoices nginx/ssl

# 3. Permisos de scripts
echo -e "${YELLOW}🔑 Paso 3: Ajustando permisos de scripts...${NC}"
chmod +x "$COMPOSE_DIR"/scripts/*.sh

# 4. Levantar base de datos primero
echo -e "${YELLOW}💾 Paso 4: Iniciando base de datos...${NC}"
docker compose up -d postgres

echo -e "${YELLOW}   Esperando a que PostgreSQL esté listo...${NC}"
for i in $(seq 1 30); do
    if docker exec granja-db pg_isready -U granja -d granja_avicola > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Base de datos lista${NC}"
        break
    fi
    sleep 2
    if [ "$i" -eq 30 ]; then
        echo -e "${RED}❌ La base de datos no respondió a tiempo. Revisá: docker compose logs postgres${NC}"
        exit 1
    fi
done

# 5. Construir e iniciar el resto de los servicios
echo -e "${YELLOW}🔨 Paso 5: Construyendo imágenes (backend, frontend, nginx)...${NC}"
docker compose build backend frontend nginx

echo -e "${YELLOW}🚀 Paso 6: Iniciando todos los servicios...${NC}"
docker compose up -d

# 6. Health check
echo -e "${YELLOW}🏥 Paso 7: Verificando servicios...${NC}"
sleep 8

if curl -s http://localhost/health > /dev/null; then
    echo -e "${GREEN}✅ Sistema funcionando correctamente${NC}"
else
    echo -e "${RED}⚠️  El health check falló. Revisá los logs:${NC}"
    echo "   docker compose logs -f"
fi

echo ""
echo -e "${GREEN}🎉 Despliegue inicial completado!${NC}"
echo ""
echo "Accedé en:  http://<IP-del-servidor>"
echo "Usuario:    admin"
echo "Contraseña: admin123  (¡cambiala después del primer login!)"
echo ""
echo "Verificar cuadre de saldos (con token admin):"
echo "   curl http://localhost/api/clientes/diagnostico/saldos"
echo ""
echo "Para futuras actualizaciones:  ./scripts/update.sh"
echo "Para ver logs:                 docker compose logs -f"
