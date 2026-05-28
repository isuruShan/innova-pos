# Stage 1: Build dependency & client builds
FROM node:20-alpine AS builder
RUN npm install -g pnpm@9.15.0
WORKDIR /app

# Copy configs and workspaces definitions
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY services/ ./services/

# Declare VITE_* build arguments so they can be passed at build time
ARG VITE_POS_URL
ARG VITE_ADMIN_URL
ARG VITE_PUBLIC_WEB_URL
ARG VITE_QR_ORDER_WEB_ORIGIN
ARG VITE_API_URL
ARG VITE_PUBLIC_WEB_API_URL
ARG VITE_QR_ORDER_API_URL

# Set them as environment variables during build
ENV VITE_POS_URL=$VITE_POS_URL
ENV VITE_ADMIN_URL=$VITE_ADMIN_URL
ENV VITE_PUBLIC_WEB_URL=$VITE_PUBLIC_WEB_URL
ENV VITE_QR_ORDER_WEB_ORIGIN=$VITE_QR_ORDER_WEB_ORIGIN
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_WEB_API_URL=$VITE_PUBLIC_WEB_API_URL
ENV VITE_QR_ORDER_API_URL=$VITE_QR_ORDER_API_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @pos/client build
RUN pnpm --filter @admin-portal/client build
RUN pnpm --filter @public-web/client build
RUN pnpm --filter @qr-order/client build

# Stage 2: PM2-managed App Backend Runner
FROM node:20-alpine AS app
RUN npm install -g pnpm@9.15.0 pm2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ecosystem.config.cjs ./
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY services/ ./services/
RUN pnpm install --frozen-lockfile
EXPOSE 5000 5001 5002 5010 3001 3002 3004

# Default environment variables for Azure Key Vault
ENV CLOUD_PROVIDER=azure
ENV AZURE_KEY_VAULT_URL=https://cafinity-dev-key.vault.azure.net/
ENV AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env

CMD ["pm2-runtime", "ecosystem.config.cjs", "--env", "production"]

# Stage 3: Nginx Reverse Proxy & Static File Server
FROM nginx:alpine AS nginx
# Copy built React SPAs
COPY --from=builder /app/apps/pos/client/dist /usr/share/nginx/html/pos
COPY --from=builder /app/apps/admin-portal/client/dist /usr/share/nginx/html/admin
COPY --from=builder /app/apps/public-web/client/dist /usr/share/nginx/html/public-web
COPY --from=builder /app/apps/qr-order/client/dist /usr/share/nginx/html/qr-order

# Dynamically switch between dev and production config directories
ARG NGINX_CONFIG_DIR=docker/nginx
# Copy configuration files
COPY ${NGINX_CONFIG_DIR}/nginx.conf /etc/nginx/nginx.conf
COPY ${NGINX_CONFIG_DIR}/conf.d/ /etc/nginx/conf.d/
EXPOSE 80 443
