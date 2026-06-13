const fs = require('fs');
const path = require('path');

const files = [
  'MenuManagement.jsx',
  'InventoryManagement.jsx',
  'SupplierManagement.jsx',
  'PurchaseOrders.jsx',
  'GoodsReceipts.jsx',
  'WastageManagement.jsx',
  'StockAudit.jsx',
  'StockReconciliation.jsx',
  'CafeTablesPage.jsx',
  'FloorPlanEditorPage.jsx',
  'FloorPlanViewPage.jsx',
  'TableAnalyticsPage.jsx'
];

const dir = path.join(__dirname, '../apps/admin-portal/client/src/pages/admin');

files.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove Navbar imports
  content = content.replace(/import\s+Navbar\s+from\s+['"].*?['"];?\r?\n?/g, '');
  // Remove MANAGER_NAV_GROUPS imports
  content = content.replace(/import\s+\{\s*MANAGER_NAV_GROUPS\s*\}\s+from\s+['"].*?['"];?\r?\n?/g, '');
  
  // Remove Navbar JSX tag
  content = content.replace(/<Navbar\s+groups=\{MANAGER_NAV_GROUPS\}\s*\/?>\r?\n?/g, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${file}`);
});
