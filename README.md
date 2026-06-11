<div align="center">

# 🥚 Granja Avícola PWA

### Sistema integral de gestión para granjas de gallinas ponedoras

Progressive Web App **self-hosted**, **mobile-first** y sin dependencias externas.
Gestioná producción, clientes, ventas y cuentas corrientes desde el celular o la compu.

<br/>

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## ✨ Características

| | Funcionalidad |
|---|---|
| 🔐 | **Autenticación JWT** con roles (admin, empleado, invitado) |
| 🐔 | **Gestión de gallineros** y registro de **producción diaria** por tamaño de huevo (S/M/L/XL) |
| 👥 | **Clientes con cuenta corriente** y saldo siempre cuadrado |
| 🧾 | **Ventas y facturación** con factura visual (imagen PNG) que se abre incluso en el celular |
| 💸 | **Pagos a cuenta** y registro de **gastos** |
| 📊 | **Dashboard** con estadísticas y gráficos |
| 📦 | **Gestión de artículos** |
| 💾 | **Backups automáticos** de la base de datos |
| 📱 | **PWA instalable** en móviles + **modo oscuro / claro** |

> 💡 **Saldo confiable:** el backend es la **única fuente de verdad** del saldo de cada cliente.
> La fórmula canónica es `saldo = Σ(facturas no anuladas) − Σ(pagos válidos)`, recalculada en cada
> operación. Al arrancar, `ensureSchema()` aplica migraciones, elimina triggers viejos y recalcula
> todos los saldos automáticamente — **no hay que tocar la base de datos a mano**.

---

## 🧱 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Next.js 14 · React 18 · TypeScript · TailwindCSS |
| **Backend** | Node.js · Express · TypeScript |
| **Base de datos** | PostgreSQL 15 |
| **Proxy / SSL** | Nginx |
| **Infraestructura** | Docker Compose |

---

## 🏗️ Arquitectura

```
                      ┌──────────────────────────────┐
   Navegador  ──────► │  Nginx  (:80 / :443)         │
   (PWA móvil)        │  proxy + SSL + factura PNG    │
                      └───────┬───────────────┬───────┘
                              │ /              │ /api
                              ▼                ▼
                     ┌────────────────┐  ┌────────────────┐
                     │ Frontend       │  │ Backend         │
                     │ Next.js (:3000)│  │ Express (:3001) │
                     └────────────────┘  └────────┬────────┘
                                                   │
                                                   ▼
                                          ┌────────────────┐
                                          │ PostgreSQL 15  │
                                          │ (granja-db)    │
                                          └────────────────┘
```

El navegador siempre habla con **el mismo dominio**: Nginx sirve la PWA en `/` y proxea la API en `/api`.

---

## 🛠️ Requisitos

- Ubuntu 20.04+ (o cualquier Linux con Docker)
- Docker 24.0+ y Docker Compose v2.20+
- 2 GB de RAM mínimo · 20 GB de disco

---

## 🚀 Primer despliegue

```bash
# 1. Clonar
cd /opt
sudo git clone <repo> granja-avicola
cd granja-avicola

# 2. Levantar todo (script idempotente: crea carpetas, levanta DB, build + up, health check)
chmod +x scripts/*.sh
bash scripts/setup.sh
```

> No hace falta crear archivos `.env` a mano: las credenciales y la URL del API (`/api`)
> ya están definidas en `docker-compose.yml`. La base se inicializa sola con `init.sql`
> la primera vez, y `ensureSchema()` se encarga del resto en cada arranque.

### Verificar

```bash
curl http://localhost/health        # estado del sistema
docker compose logs -f              # logs en vivo
```

---

## 🔄 Actualizar (app ya en producción)

```bash
cd /opt/granja-avicola
bash scripts/update.sh
```

`update.sh` hace **backup automático**, `git pull`, reconstruye las imágenes con `--no-cache`
(incluido el frontend, para que tome la URL `/api` horneada en el bundle) y levanta todo de nuevo.

---

## 🌐 Acceso

| | URL / Credencial |
|---|---|
| **App** | `http://localhost` (o tu dominio) |
| **API** | `http://localhost/api` |
| **Usuario por defecto** | `admin` / `admin123` |

> ⚠️ **Cambiá la contraseña de `admin` después del primer login.**

---

## 📁 Estructura del proyecto

```
granja-avicola/
├── docker-compose.yml      # Orquestación de servicios
├── nginx/                  # Proxy reverso + SSL
├── database/
│   └── init.sql            # Schema inicial (corre solo la 1ª vez)
├── backend/                # API REST (Express + TS)
│   └── src/
│       ├── config/         # DB + helper recalcularSaldoCliente()
│       ├── middleware/     # auth JWT
│       └── routes/         # clientes, ventas, dashboard, gastos, ...
├── frontend/               # PWA Next.js 14
│   ├── app/                # rutas / páginas
│   ├── components/
│   └── store/              # estado (zustand)
├── scripts/                # setup.sh · update.sh · backup.sh · restore.sh
└── backups/                # backups automáticos + facturas
```

---

## 🔧 Comandos útiles

```bash
# Reiniciar todo
docker compose restart

# Ver logs de un servicio
docker compose logs -f backend

# Backup manual
bash scripts/backup.sh

# Restaurar un backup
bash scripts/restore.sh backups/granja_2024-01-15_14-30-00.sql.gz

# Actualizar (backup + pull + rebuild)
bash scripts/update.sh

# Diagnóstico de saldos (requiere token admin) → debería dar "descuadrados: 0"
curl -H "Authorization: Bearer TU_TOKEN" http://localhost/api/clientes/diagnostico/saldos
```

---

## 💾 Backups

El script `scripts/backup.sh` genera un dump comprimido de PostgreSQL (`.sql.gz`) y respalda
la carpeta `invoices/`, borrando automáticamente los backups de más de 30 días.

```bash
# Backup manual
bash scripts/backup.sh

# Programar backup diario por cron (ejemplo: 3 AM)
sudo crontab -e
# 0 3 * * * cd /opt/granja-avicola && bash scripts/backup.sh
```

---

## 📱 PWA — Instalación en el celular

1. Abrí la app en Chrome/Safari móvil.
2. Menú → **"Agregar a pantalla de inicio"**.
3. Listo: queda como una app nativa y funciona con datos cacheados.

---

## 🐛 Troubleshooting

<details>
<summary><b>Demasiadas peticiones (rate limit)</b></summary>

El backend usa `trust proxy` para leer la IP real detrás de Nginx y un límite de 1000 req / 15 min.
Si lo ves igual, asegurate de haber reconstruido el backend (`docker compose build backend`).
</details>

<details>
<summary><b>El navegador sigue pegándole a <code>localhost:3001</code></b></summary>

La URL del API se **hornea en build**. Reconstruí el frontend con `--no-cache`
(o simplemente corré `bash scripts/update.sh`).
</details>

<details>
<summary><b>Problemas de permisos</b></summary>

```bash
sudo chown -R $USER:$USER /opt/granja-avicola
```
</details>

<details>
<summary><b>Resetear la base de datos (⚠️ borra datos)</b></summary>

```bash
docker compose down -v
docker compose up -d postgres   # esperá ~10s
docker compose up -d
```
</details>

<details>
<summary><b>SSL / HTTPS</b></summary>

Ver `nginx/README.md` para configurar Let's Encrypt.
</details>

---

## 📄 Licencia

**MIT** — Libre para uso personal y comercial.

<div align="center">
<sub>Hecho con 🥚 para administrar la granja sin dolores de cabeza.</sub>
</div>
