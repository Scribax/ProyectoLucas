FROM nginx:alpine

# Copiar configuración
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Crear directorio para facturas
RUN mkdir -p /var/www/invoices && chown -R nginx:nginx /var/www/invoices

# Exponer puerto
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
