#!/bin/bash

# ──────────────────────────────────────────────────────────────────────────────
# Redeploy Nginx Configuration Script
# Must be executed on the production server (with sudo privileges).
# ──────────────────────────────────────────────────────────────────────────────

set -e

# Target paths
NGINX_CONF_DIR="/etc/nginx/conf.d"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
PROJECT_ROOT="/home/innovapos-production-env/innova-pos"
BACKUP_DIR="/home/innovapos-production-env/nginx_backup/$(date +%Y%m%d_%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0;3c' # No Color
NC='\033[0m'

echo -e "${YELLOW}=== Nginx Config Redeployment Script ===${NC}"

# Check for root privileges
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root. Try running with sudo.${NC}"
  exit 1
fi

# 1. Create backup directory
echo -e "\n${GREEN}[1/5] Backing up current configurations...${NC}"
mkdir -p "$BACKUP_DIR"

if [ -d "$NGINX_CONF_DIR" ]; then
  cp -r "$NGINX_CONF_DIR/"* "$BACKUP_DIR/" 2>/dev/null || true
fi
if [ -d "$NGINX_SITES_ENABLED" ]; then
  mkdir -p "$BACKUP_DIR/sites-enabled"
  cp -r "$NGINX_SITES_ENABLED/"* "$BACKUP_DIR/sites-enabled/" 2>/dev/null || true
fi

echo -e "Backed up existing Nginx configs to: ${YELLOW}$BACKUP_DIR${NC}"

# 2. Clean up active Nginx configurations
echo -e "\n${GREEN}[2/5] Cleaning active configuration folders...${NC}"

# Delete existing project conf files
rm -f "$NGINX_CONF_DIR/pos.conf"
rm -f "$NGINX_CONF_DIR/admin-portal.conf"
rm -f "$NGINX_CONF_DIR/public-web.conf"
rm -f "$NGINX_CONF_DIR/qr-order.conf"
rm -f "$NGINX_CONF_DIR/default.conf"

# Remove standard default server blocks (crucial to prevent hostname routing conflicts)
rm -f "$NGINX_SITES_ENABLED/default"
rm -f "$NGINX_CONF_DIR/default"

# Remove any old backup/unwanted configs that might have same upstream names
rm -f "$NGINX_CONF_DIR"/*.conf.bak
rm -f "$NGINX_CONF_DIR"/*.conf.backup

echo -e "Cleaned up active configuration directories."

# 3. Copy clean configs from project
echo -e "\n${GREEN}[3/5] Copying clean configuration files from project repository...${NC}"

SRC_DIR="$PROJECT_ROOT/nginx/production_vm"

if [ ! -d "$SRC_DIR" ]; then
  echo -e "${RED}Error: Production source folder not found at $SRC_DIR${NC}"
  echo -e "Make sure you ran 'git pull' and the path is correct."
  exit 1
fi

cp "$SRC_DIR/pos.conf"          "$NGINX_CONF_DIR/pos.conf"
cp "$SRC_DIR/admin-portal.conf" "$NGINX_CONF_DIR/admin-portal.conf"
cp "$SRC_DIR/public-web.conf"   "$NGINX_CONF_DIR/public-web.conf"
cp "$SRC_DIR/qr-order.conf"      "$NGINX_CONF_DIR/qr-order.conf"

echo -e "Successfully copied Nginx configurations to: ${YELLOW}$NGINX_CONF_DIR${NC}"

# 4. Test configuration syntax
echo -e "\n${GREEN}[4/5] Testing Nginx configuration syntax...${NC}"
if nginx -t; then
  echo -e "${GREEN}Nginx syntax check passed successfully!${NC}"
else
  echo -e "${RED}Error: Nginx configuration test failed. Restoring backup...${NC}"
  
  # Restore backup
  rm -f "$NGINX_CONF_DIR"/*
  cp -r "$BACKUP_DIR"/* "$NGINX_CONF_DIR/" 2>/dev/null || true
  if [ -d "$BACKUP_DIR/sites-enabled" ]; then
    cp -r "$BACKUP_DIR/sites-enabled/"* "$NGINX_SITES_ENABLED/" 2>/dev/null || true
  fi
  
  echo -e "${YELLOW}Restored original configurations from: $BACKUP_DIR${NC}"
  exit 1
fi

# 5. Reload Nginx
echo -e "\n${GREEN}[5/5] Reloading Nginx service...${NC}"
systemctl reload nginx
echo -e "${GREEN}=== Nginx config successfully redeployed! ===${NC}"
echo -e "Please test the domains: ${YELLOW}pos.cafinity.io${NC}, ${YELLOW}admin.cafinity.io${NC}, and ${YELLOW}cafinity.io${NC}"
