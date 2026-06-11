# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# URL del API horneada en el bundle del cliente (NEXT_PUBLIC_* se resuelve en build).
# Por defecto relativa "/api" para que el navegador llame al MISMO dominio
# (https://tudominio/api) y nginx la proxee; así no queda "localhost" hardcodeado
# ni se rompe por mixed-content en producción.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copiar solo lo necesario
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
