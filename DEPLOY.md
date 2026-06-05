# Manual de Despliegue - Granja Avícola PWA

Guía completa para desplegar en VPS Ubuntu Server con Docker Compose.

## 📋 Requisitos del Servidor

- **OS**: Ubuntu 20.04 LTS o 22.04 LTS
- **RAM**: 2GB mínimo (4GB recomendado)
- **Disco**: 20GB SSD mínimo
- **Puertos**: 80, 443 (si usas HTTPS)
- **Usuario**: con privilegios sudo (no root)

## 🚀 Despliegue Paso a Paso

### Paso 1: Preparar el Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias básicas
sudo apt install -y curl wget git nano htop

# Crear directorio de la aplicación
sudo mkdir -p /opt/granja-avicola
sudo chown $USER:$USER /opt/granja-avicola
```

### Paso 2: Instalar Docker

```bash
# Desinstalar versiones viejas
sudo apt remove docker docker-engine docker.io containerd runc

# Instalar Docker oficial
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER
newgrp docker  # Recargar grupo (o logout/login)

# Verificar
docker --version  # Docker 24.x+
docker compose version  # Docker Compose 2.x+
```

### Paso 3: Copiar Archivos del Proyecto

Desde tu máquina local, copia los archivos al servidor:

```bash
# Opción A: SCP
cd c:/Users/franc/Desktop/Proyecto\ LUCAS
scp -r granja-avicola/* usuario@tuservidor:/opt/granja-avicola/

# Opción B: Subir ZIP y extraer
# (subir granja-avicola.zip al servidor)
ssh usuario@tuservidor
cd /opt/granja-avicola
unzip granja-avicola.zip
```

O si tienes acceso directo al servidor:

```bash
cd /opt
# Clonar o copiar manualmente los archivos
sudo mkdir -p granja-avicola
cd granja-avicola
# Copiar todos los archivos del proyecto aquí
```

### Paso 4: Configurar Variables de Entorno

```bash
cd /opt/granja-avicola

# Backend - crear .env
cat > backend/.env << 'EOF'
NODE_ENV=production
PORT=3001
DB_HOST=db
DB_PORT=5432
DB_NAME=granja_avicola
DB_USER=postgres
DB_PASSWORD=tu_password_seguro_aqui
JWT_SECRET=tu_jwt_secret_aleatorio_largo_aqui_min_32_chars
JWT_EXPIRES_IN=7d
EOF

# Frontend - crear .env.local
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost/api
NEXT_PUBLIC_APP_NAME=Granja Avícola
EOF
```

**⚠️ IMPORTANTE: Cambia las contraseñas!**

### Paso 5: Configurar Permisos y Scripts

```bash
cd /opt/granja-avicola

# Hacer scripts ejecutables
chmod +x scripts/*.sh

# Crear directorios necesarios
mkdir -p backups invoices nginx/ssl

# Ajustar permisos
sudo chown -R 1000:1000 /opt/granja-avicola
```

### Paso 6: Iniciar por Primera Vez

```bash
cd /opt/granja-avicola

# Verificar configuración
sudo docker compose config

# Iniciar solo la base de datos primero (para inicializar)
sudo docker compose up -d db

# Esperar 30 segundos para que PostgreSQL inicie
sleep 30

# Verificar que DB está lista
sudo docker logs granja-db | tail -20

# Iniciar todos los servicios
sudo docker compose up -d

# Verificar estado
sudo docker compose ps
```

### Paso 7: Verificar Instalación

```bash
# Health check
curl http://localhost/health

# Ver logs
sudo docker compose logs -f

# En otra terminal, probar login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Deberías ver una respuesta con token JWT.

### Paso 8: Configurar Dominio (Opcional)

Si tienes un dominio, edita `nginx/nginx.conf`:

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    # ... resto de la config
}
```

Reiniciar:
```bash
sudo docker compose restart nginx
```

### Paso 9: HTTPS con Let's Encrypt (Opcional pero Recomendado)

```bash
# Instalar certbot
sudo apt install certbot

# Obtener certificado
sudo certbot certonly --standalone -d tu-dominio.com

# Copiar certificados
sudo cp /etc/letsencrypt/live/tu-dominio.com/fullchain.pem /opt/granja-avicola/nginx/ssl/
sudo cp /etc/letsencrypt/live/tu-dominio.com/privkey.pem /opt/granja-avicola/nginx/ssl/

# Actualizar nginx.conf para HTTPS (ver nginx/README-SSL.md)
```

### Paso 10: Backup Automático (Cron)

```bash
# Editar crontab
sudo crontab -e

# Agregar línea para backup diario a las 2 AM:
0 2 * * * /opt/granja-avicola/scripts/backup.sh >> /var/log/granja-backup.log 2>&1

# Guardar y salir
```

Verificar:
```bash
sudo crontab -l
```

## 🔧 Comandos de Mantenimiento

### Ver logs
```bash
# Todos los servicios
sudo docker compose logs -f

# Servicio específico
sudo docker compose logs -f backend
sudo docker compose logs -f frontend
sudo docker compose logs -f db
```

### Reiniciar servicios
```bash
sudo docker compose restart
# o específico:
sudo docker compose restart backend
```

### Actualizar la aplicación
```bash
cd /opt/granja-avicola
./scripts/update.sh
```

### Backup manual
```bash
cd /opt/granja-avicola
./scripts/backup.sh mi_backup
# Resultado: backups/mi_backup.sql.gz
```

### Restaurar backup
```bash
cd /opt/granja-avicola
./scripts/restore.sh backups/granja_2024-01-15_10-30-00.sql.gz
```

### Acceder a la base de datos
```bash
sudo docker exec -it granja-db psql -U postgres -d granja_avicola

# Ejemplo: ver usuarios
\dt
SELECT * FROM users;
\q  # salir
```

## 🐛 Troubleshooting

### Puerto 80 ocupado
```bash
# Ver qué usa el puerto 80
sudo netstat -tlnp | grep :80

# Detener servicio conflictivo
sudo systemctl stop apache2  # o nginx del host
```

### Error de permisos en volúmenes
```bash
sudo chown -R 1000:1000 /opt/granja-avicola
sudo chmod -R 755 /opt/granja-avicola/backups
```

### Base de datos no inicia
```bash
# Ver logs detallados
sudo docker logs granja-db

# Limpiar y reiniciar (⚠️ perderás datos!)
sudo docker compose down -v
sudo docker compose up -d db
sleep 30
sudo docker compose up -d
```

### Error "connection refused" al API
```bash
# Verificar que backend está corriendo
sudo docker compose ps backend

# Revisar logs del backend
sudo docker compose logs backend
```

## 📱 Acceso Post-Instalación

Una vez desplegado:

- **Web App**: http://tu-servidor-o-ip
- **Usuario**: `admin`
- **Contraseña**: `admin123`

**⚠️ IMPORTANTE**: Cambia la contraseña del admin después del primer login.

## 🔄 Flujo de Actualización Futura

Cuando haya nuevas versiones:

1. Backup: `./scripts/backup.sh`
2. Descargar nuevos archivos
3. Ejecutar: `./scripts/update.sh`
4. Verificar: `curl http://localhost/health`

## 📞 Soporte

Si encuentras problemas:

1. Revisar logs: `sudo docker compose logs`
2. Verificar health: `curl http://localhost/health`
3. Verificar DB: `sudo docker exec granja-db pg_isready -U postgres`
4. Reiniciar todo: `sudo docker compose restart`

## 📊 Monitoreo Básico

```bash
# Uso de recursos
docker stats

# Espacio en disco
df -h

# Tamaño de backups
ls -lh /opt/granja-avicola/backups/
```

---

**Despliegue completado!** 🎉
