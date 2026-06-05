# Granja Avícola PWA - Sistema de Gestión

Sistema integral de gestión para granja de gallinas ponedoras. Progressive Web App (PWA) self-hosted, mobile-first, sin dependencias externas.

## 🚀 Características

- **Autenticación JWT** con roles (admin, empleado, invitado)
- **Gestión de gallineros** y producción diaria
- **Control de clientes** con cuenta corriente
- **Ventas y facturación** visual (imágenes PNG)
- **Dashboard** con estadísticas y gráficos
- **Reportes exportables** (Excel/CSV)
- **Backup automático** de base de datos
- **PWA** installable en móviles
- **Dark/Light mode**

## 📋 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 15 |
| Proxy | Nginx |
| Infra | Docker Compose |

## 🛠️ Requisitos

- Ubuntu 20.04+ (o cualquier Linux con Docker)
- Docker 24.0+
- Docker Compose 2.20+
- 2GB RAM mínimo
- 20GB disco

## 📦 Instalación

### 1. Clonar y preparar

```bash
cd /opt
sudo git clone <repo> granja-avicola
cd granja-avicola
```

### 2. Variables de entorno

```bash
# Backend
cp backend/.env.example backend/.env
# Editar backend/.env con tus valores

# Frontend  
cp frontend/.env.local.example frontend/.env.local
# Editar frontend/.env.local
```

### 3. Iniciar servicios

```bash
sudo docker compose up -d
```

### 4. Verificar

```bash
# Health check
curl http://localhost/health

# Ver logs
sudo docker compose logs -f
```

## 🌐 Acceso

- **App**: http://localhost (o tu dominio)
- **API**: http://localhost/api
- **Usuario default**: `admin` / `admin123`

## 📁 Estructura

```
granja-avicola/
├── docker-compose.yml      # Orquestación
├── nginx/                  # Proxy y SSL
├── database/
│   └── init.sql            # Schema completo
├── backend/                # API REST
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   └── routes/
│   └── Dockerfile
├── frontend/               # PWA Next.js
│   ├── app/
│   ├── components/
│   └── store/
└── backups/                # Backups automáticos
```

## 🔧 Comandos útiles

```bash
# Reiniciar todo
sudo docker compose restart

# Ver logs de un servicio
sudo docker compose logs -f backend

# Backup manual
./scripts/backup.sh

# Restaurar backup
./scripts/restore.sh backups/granja_2024-01-15_14-30-00.sql

# Actualizar (pull + rebuild)
./scripts/update.sh
```

## 🔄 Backup automático

El sistema incluye backup diario automático configurado en `cron`:

```bash
# Verificar cron
sudo crontab -l

# Backup manual
sudo docker exec granja-db pg_dump -U postgres granja_avicola > backup_$(date +%Y%m%d).sql
```

## 📱 PWA - Instalación móvil

1. Abrir la app en Chrome/Safari móvil
2. Menu → "Agregar a pantalla de inicio"
3. Funciona offline con datos cacheados

## 🐛 Troubleshooting

### Problemas de permisos
```bash
sudo chown -R $USER:$USER /opt/granja-avicola
```

### Resetear base de datos
```bash
sudo docker compose down -v
sudo docker compose up -d db
# Esperar 10s, luego:
sudo docker compose up -d
```

### SSL/HTTPS
Ver `nginx/README.md` para configurar Let's Encrypt.

## 📄 Licencia

MIT - Libre para uso personal y comercial.
