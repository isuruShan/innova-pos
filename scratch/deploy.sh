#!/bin/bash
set -e

KEY_PATH="/home/isuru/Projects/Cafinity Assets/ip-prod-vm_key.pem"
VM_USER="azureuser"
VM_IP="4.210.225.255"
VM_DEST="azureuser@${VM_IP}:/home/azureuser/innova/innova-pos"

echo "=== 1. Creating directories on remote VM ==="
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "${VM_USER}@${VM_IP}" \
  "mkdir -p /home/azureuser/innova/innova-pos/apps/pos/client/src/components/manager/reports/ /home/azureuser/innova/innova-pos/apps/admin-portal/client/src/components/admin/reports/"

echo "=== 2. Copying server routes ==="
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  /home/isuru/Projects/splitsecond-pos/apps/pos/server/src/routes/reportsExtended.js \
  "${VM_DEST}/apps/pos/server/src/routes/"

scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  /home/isuru/Projects/splitsecond-pos/apps/admin-portal/server/src/routes/reportsExtended.js \
  "${VM_DEST}/apps/admin-portal/server/src/routes/"

echo "=== 3. Copying POS Client files ==="
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  /home/isuru/Projects/splitsecond-pos/apps/pos/client/src/components/manager/reports/CogsView.jsx \
  /home/isuru/Projects/splitsecond-pos/apps/pos/client/src/components/manager/reports/WastageReportView.jsx \
  /home/isuru/Projects/splitsecond-pos/apps/pos/client/src/components/manager/reports/LoyaltyReportView.jsx \
  "${VM_DEST}/apps/pos/client/src/components/manager/reports/"

scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  /home/isuru/Projects/splitsecond-pos/apps/pos/client/src/pages/manager/ReportsPortal.jsx \
  "${VM_DEST}/apps/pos/client/src/pages/manager/"

scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  /home/isuru/Projects/splitsecond-pos/apps/pos/client/src/constants/managerLinks.js \
  "${VM_DEST}/apps/pos/client/src/constants/"

echo "=== 4. Copying Admin Portal Client files ==="
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  /home/isuru/Projects/splitsecond-pos/apps/admin-portal/client/src/components/admin/reports/CogsView.jsx \
  /home/isuru/Projects/splitsecond-pos/apps/admin-portal/client/src/components/admin/reports/WastageReportView.jsx \
  /home/isuru/Projects/splitsecond-pos/apps/admin-portal/client/src/components/admin/reports/LoyaltyReportView.jsx \
  "${VM_DEST}/apps/admin-portal/client/src/components/admin/reports/"

scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  /home/isuru/Projects/splitsecond-pos/apps/admin-portal/client/src/pages/admin/ReportsPortal.jsx \
  "${VM_DEST}/apps/admin-portal/client/src/pages/admin/"

scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  /home/isuru/Projects/splitsecond-pos/apps/admin-portal/client/src/components/layout/Layout.jsx \
  "${VM_DEST}/apps/admin-portal/client/src/components/layout/"

echo "=== 5. Rebuilding client assets on VM ==="
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "${VM_USER}@${VM_IP}" \
  "cd /home/azureuser/innova/innova-pos && pnpm --filter @pos/client --filter @admin-portal/client run build"

echo "=== 6. Reloading server services via PM2 ==="
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "${VM_USER}@${VM_IP}" \
  "pm2 reload pos-server admin-server"

echo "=== Deployment Completed Successfully! ==="
