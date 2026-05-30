/**
 * CSV/Excel Export and Import utilities for menu items, categories, and orders
 */

/**
 * Convert array of objects to CSV string
 */
export function arrayToCSV(headers, rows) {
  const escapeCSV = (val) => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escapeCSV).join(',');
  const dataRows = rows.map((row) => row.map(escapeCSV).join(','));
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export menu items to CSV with variant support
 */
export function exportMenuItemsToCSV(items) {
  const headers = [
    'Name',
    'Category',
    'Price',
    'Description',
    'Available',
    'Sort Order',
    'Is Combo',
    'Has Variants',
    'Variant Options',
    'Variants',
    'Default Variant',
    'Image URL'
  ];
  
  const rows = items.map((item) => {
    let variantOptionsStr = '';
    let variantsStr = '';
    let defaultVariantName = '';
    
    if (item.hasVariants && item.variantOptions?.length > 0) {
      // Encode variant options: Size:Small,Large|Flavor:Vanilla,Mocha
      variantOptionsStr = item.variantOptions
        .map(opt => `${opt.name}:${(opt.values || []).join(',')}`)
        .join('|');
      
      // Encode variants: Small / Vanilla:4.00:1|Large / Vanilla:5.00:1
      // Format: name:price:available (available: 1=true, 0=false)
      if (item.variants?.length > 0) {
        variantsStr = item.variants
          .map(v => `${v.name}:${v.price || 0}:${v.available !== false ? '1' : '0'}`)
          .join('|');
        
        // Find default variant name
        if (item.defaultVariantId) {
          const defaultV = item.variants.find(v => String(v._id) === String(item.defaultVariantId));
          if (defaultV) defaultVariantName = defaultV.name;
        }
      }
    }
    
    return [
      item.name,
      item.category,
      item.price || 0,
      item.description || '',
      item.available ? 'Yes' : 'No',
      item.sortOrder || 0,
      item.isCombo ? 'Yes' : 'No',
      item.hasVariants ? 'Yes' : 'No',
      variantOptionsStr,
      variantsStr,
      defaultVariantName,
      item.images?.[0]?.url || item.image || ''
    ];
  });

  const csvContent = arrayToCSV(headers, rows);
  downloadCSV('menu_items', csvContent);
}

/**
 * Export categories to CSV
 */
export function exportCategoriesToCSV(categories) {
  const headers = [
    'Name',
    'Active',
    'Sort Order'
  ];
  
  const rows = categories.map((cat) => [
    cat.name,
    cat.active ? 'Yes' : 'No',
    cat.sortOrder || 0
  ]);

  const csvContent = arrayToCSV(headers, rows);
  downloadCSV('categories', csvContent);
}

/**
 * Export orders to CSV
 */
export function exportOrdersToCSV(orders) {
  const headers = [
    'Order Number',
    'Customer Name',
    'Order Type',
    'Payment Type',
    'Status',
    'Total Amount',
    'Discount Total',
    'Items',
    'Created At',
    'Created By'
  ];
  
  const rows = orders.map((order) => [
    order.orderNumber,
    order.customerId?.name || 'Walk-in',
    order.orderType || '',
    order.paymentType || '',
    order.status,
    order.totalAmount || 0,
    order.discountTotal || 0,
    order.items.map(i => `${i.name} x${i.qty}`).join('; '),
    new Date(order.createdAt).toLocaleString(),
    order.createdBy?.name || ''
  ]);

  const csvContent = arrayToCSV(headers, rows);
  downloadCSV('orders', csvContent);
}

/**
 * Parse CSV file to array of objects
 */
export async function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }

        // Parse CSV considering quoted values
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCSVLine(lines[0]);
        const rows = lines.slice(1).map(parseCSVLine);
        
        const data = rows.map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });

        resolve({ headers, data });
      } catch (error) {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Get menu item import field definitions
 */
export function getMenuItemImportFields() {
  return [
    { key: 'name', label: 'Name *', required: true, type: 'text' },
    { key: 'category', label: 'Category *', required: true, type: 'text' },
    { key: 'price', label: 'Price', required: false, type: 'number' },
    { key: 'description', label: 'Description', required: false, type: 'text' },
    { key: 'available', label: 'Available', required: false, type: 'boolean' },
    { key: 'sortOrder', label: 'Sort Order', required: false, type: 'number' },
    { key: 'hasVariants', label: 'Has Variants', required: false, type: 'boolean' },
    { key: 'variantOptions', label: 'Variant Options', required: false, type: 'text' },
    { key: 'variants', label: 'Variants', required: false, type: 'text' },
    { key: 'defaultVariant', label: 'Default Variant', required: false, type: 'text' },
    { key: 'imageUrl', label: 'Image URL', required: false, type: 'text' }
  ];
}

/**
 * Get category import field definitions
 */
export function getCategoryImportFields() {
  return [
    { key: 'name', label: 'Name *', required: true, type: 'text' },
    { key: 'active', label: 'Active', required: false, type: 'boolean' },
    { key: 'sortOrder', label: 'Sort Order', required: false, type: 'number' }
  ];
}

/**
 * Get order import field definitions
 */
export function getOrderImportFields() {
  return [
    { key: 'orderNumber', label: 'Order Number *', required: true, type: 'number' },
    { key: 'customerName', label: 'Customer Name', required: false, type: 'text' },
    { key: 'orderType', label: 'Order Type *', required: true, type: 'text' },
    { key: 'paymentType', label: 'Payment Type *', required: true, type: 'text' },
    { key: 'totalAmount', label: 'Total Amount *', required: true, type: 'number' },
    { key: 'status', label: 'Status *', required: true, type: 'text' },
    { key: 'items', label: 'Items *', required: true, type: 'text' }
  ];
}

/**
 * Parse variant options string: "Size:Small,Large|Flavor:Vanilla,Mocha"
 */
function parseVariantOptions(str) {
  if (!str || !str.trim()) return [];
  
  return str.split('|').map(part => {
    const [name, ...valuesParts] = part.split(':');
    const valuesStr = valuesParts.join(':'); // Handle values with colons
    const values = valuesStr ? valuesStr.split(',').map(v => v.trim()).filter(Boolean) : [];
    return { name: name.trim(), values };
  }).filter(opt => opt.name && opt.values.length > 0);
}

/**
 * Parse variants string: "Small / Vanilla:4.00:1|Large / Vanilla:5.00:1"
 */
function parseVariants(str, variantOptions) {
  if (!str || !str.trim()) return [];
  
  const variants = [];
  const parts = str.split('|');
  
  for (const part of parts) {
    const lastColon = part.lastIndexOf(':');
    const secondLastColon = part.lastIndexOf(':', lastColon - 1);
    
    if (secondLastColon === -1) continue; // Invalid format
    
    const name = part.substring(0, secondLastColon).trim();
    const priceStr = part.substring(secondLastColon + 1, lastColon).trim();
    const availableStr = part.substring(lastColon + 1).trim();
    
    const price = parseFloat(priceStr);
    if (isNaN(price)) continue; // Skip invalid price
    
    // Build attributes from name by matching variant option values
    const attributes = [];
    for (const opt of variantOptions) {
      for (const val of opt.values) {
        if (name.includes(val)) {
          attributes.push({ name: opt.name, value: val });
          break;
        }
      }
    }
    
    variants.push({
      name,
      price,
      available: availableStr === '1' || availableStr.toLowerCase() === 'true',
      attributes,
      description: '',
      images: []
    });
  }
  
  return variants;
}

/**
 * Validate and transform menu item row with variant support
 */
export function validateMenuItemRow(row, mapping, rowIndex) {
  const errors = [];
  const item = {};

  // Name (required)
  const name = row[mapping.name]?.trim();
  if (!name) {
    errors.push(`Row ${rowIndex + 1}: Name is required`);
  } else {
    item.name = name;
  }

  // Category (required)
  const category = row[mapping.category]?.trim();
  if (!category) {
    errors.push(`Row ${rowIndex + 1}: Category is required`);
  } else {
    item.category = category;
  }

  // Check if this has variants
  const hasVariantsStr = row[mapping.hasVariants]?.trim().toLowerCase();
  const hasVariants = hasVariantsStr === 'yes' || hasVariantsStr === 'true' || hasVariantsStr === '1';
  item.hasVariants = hasVariants;

  // Price (required only if no variants)
  const priceStr = row[mapping.price]?.trim();
  const price = parseFloat(priceStr);
  
  if (hasVariants) {
    // For variant items, base price can be 0
    item.price = 0;
    
    // Parse variant options
    const variantOptionsStr = row[mapping.variantOptions]?.trim();
    const variantOptions = parseVariantOptions(variantOptionsStr);
    
    if (variantOptions.length === 0) {
      errors.push(`Row ${rowIndex + 1}: Variant options are required when Has Variants is Yes`);
    } else {
      item.variantOptions = variantOptions;
      
      // Parse variants
      const variantsStr = row[mapping.variants]?.trim();
      const variants = parseVariants(variantsStr, variantOptions);
      
      if (variants.length === 0) {
        errors.push(`Row ${rowIndex + 1}: At least one variant is required when Has Variants is Yes`);
      } else {
        item.variants = variants;
        
        // Note: Default variant cannot be set during import since variant IDs
        // are generated by the server. User can set default after import.
      }
    }
  } else {
    // Regular item - price is required
    if (isNaN(price) || price < 0) {
      errors.push(`Row ${rowIndex + 1}: Price must be a valid positive number`);
    } else {
      item.price = price;
    }
  }

  // Optional fields
  item.description = row[mapping.description]?.trim() || '';
  
  const availableStr = row[mapping.available]?.trim().toLowerCase();
  item.available = !availableStr || availableStr === 'yes' || availableStr === 'true' || availableStr === '1';
  
  const sortOrderStr = row[mapping.sortOrder]?.trim();
  item.sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0;
  
  const imageUrl = row[mapping.imageUrl]?.trim();
  const isValidUrl = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
  if (isValidUrl) {
    item.images = [{ url: imageUrl, key: '' }];
  } else {
    item.images = [];
  }

  return { item: errors.length === 0 ? item : null, errors };
}

/**
 * Validate and transform category row
 */
export function validateCategoryRow(row, mapping, rowIndex) {
  const errors = [];
  const category = {};

  // Name (required)
  const name = row[mapping.name]?.trim();
  if (!name) {
    errors.push(`Row ${rowIndex + 1}: Name is required`);
  } else {
    category.name = name;
  }

  // Optional fields
  const activeStr = row[mapping.active]?.trim().toLowerCase();
  category.active = !activeStr || activeStr === 'yes' || activeStr === 'true' || activeStr === '1';
  
  const sortOrderStr = row[mapping.sortOrder]?.trim();
  category.sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0;

  return { category: errors.length === 0 ? category : null, errors };
}

/**
 * Validate and transform order row
 */
export function validateOrderRow(row, mapping, rowIndex) {
  const errors = [];
  const order = {};

  // Order Number (required)
  const orderNumber = parseInt(row[mapping.orderNumber], 10);
  if (isNaN(orderNumber)) {
    errors.push(`Row ${rowIndex + 1}: Order Number must be a valid number`);
  } else {
    order.orderNumber = orderNumber;
  }

  // Customer Name (optional)
  order.customerName = row[mapping.customerName]?.trim() || 'Walk-in';

  // Order Type (required)
  const orderType = row[mapping.orderType]?.trim().toLowerCase();
  if (!orderType) {
    errors.push(`Row ${rowIndex + 1}: Order Type is required`);
  } else if (!['dine-in', 'takeaway', 'uber-eats', 'pickme'].includes(orderType)) {
    errors.push(`Row ${rowIndex + 1}: Invalid Order Type (must be: dine-in, takeaway, uber-eats, pickme)`);
  } else {
    order.orderType = orderType;
  }

  // Payment Type (required)
  const paymentType = row[mapping.paymentType]?.trim().toLowerCase();
  if (!paymentType) {
    errors.push(`Row ${rowIndex + 1}: Payment Type is required`);
  } else if (!['cash', 'card', 'online', 'bank_transfer'].includes(paymentType)) {
    errors.push(`Row ${rowIndex + 1}: Invalid Payment Type (must be: cash, card, online, bank_transfer)`);
  } else {
    order.paymentType = paymentType;
  }

  // Total Amount (required)
  const totalAmount = parseFloat(row[mapping.totalAmount]);
  if (isNaN(totalAmount) || totalAmount < 0) {
    errors.push(`Row ${rowIndex + 1}: Total Amount must be a valid positive number`);
  } else {
    order.totalAmount = totalAmount;
  }

  // Status (required)
  const status = row[mapping.status]?.trim().toLowerCase();
  if (!status) {
    errors.push(`Row ${rowIndex + 1}: Status is required`);
  } else if (!['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(status)) {
    errors.push(`Row ${rowIndex + 1}: Invalid Status (must be: pending, preparing, ready, completed, cancelled)`);
  } else {
    order.status = status;
  }

  // Items (required) - Format: "Item Name x Qty; Item2 x Qty2"
  const itemsStr = row[mapping.items]?.trim();
  if (!itemsStr) {
    errors.push(`Row ${rowIndex + 1}: Items are required`);
  } else {
    try {
      const items = itemsStr.split(';').map(item => {
        const match = item.trim().match(/^(.+?)\\s*x\\s*(\\d+)$/);
        if (!match) throw new Error('Invalid item format');
        return {
          name: match[1].trim(),
          qty: parseInt(match[2], 10),
          price: totalAmount / itemsStr.split(';').length // Simple distribution
        };
      });
      order.items = items;
    } catch (e) {
      errors.push(`Row ${rowIndex + 1}: Items must be in format "Name x Qty; Name2 x Qty2"`);
    }
  }

  return { order: errors.length === 0 ? order : null, errors };
}
