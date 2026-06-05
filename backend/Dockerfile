# Dockerfile para Backend Node.js/Express
FROM node:20-alpine

# Instalar dependencias para canvas
RUN apk add --no-cache \
    python3 \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Crear directorios necesarios
RUN mkdir -p /app/invoices /app/backups

# Exponer puerto
EXPOSE 3001

# Comando de inicio
CMD ["node", "dist/index.js"]
