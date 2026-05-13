FROM nginx:alpine

# Copy all frontend static files to the nginx document root.
COPY . /usr/share/nginx/html/

# Replace the default nginx configuration with our SPA + cache-control config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
