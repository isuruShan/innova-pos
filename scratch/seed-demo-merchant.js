'use strict';

/**
 * Splitsecond POS & Admin Portal - Demo Merchant & 2-Week Data Generator
 * Usage: node scratch/seed-demo-merchant.js
 */

require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

// Relative paths from scratch/ directory
const Tenant = require('../apps/admin-portal/server/src/models/Tenant');
const Store = require('../apps/admin-portal/server/src/models/Store');
const User = require('../apps/admin-portal/server/src/models/User');
const Inventory = require('../apps/admin-portal/server/src/models/Inventory');
const MenuItem = require('../apps/admin-portal/server/src/models/MenuItem');
const IngredientLink = require('../apps/admin-portal/server/src/models/IngredientLink');
const Order = require('../apps/admin-portal/server/src/models/Order');
const StockMovement = require('../apps/admin-portal/server/src/models/StockMovement');
const StorageArea = require('../apps/admin-portal/server/src/models/StorageArea');
const CountSheet = require('../apps/admin-portal/server/src/models/CountSheet');
const InventoryCountSession = require('../apps/admin-portal/server/src/models/InventoryCountSession');
const StockTransfer = require('../apps/admin-portal/server/src/models/StockTransfer');
const FoodmarketPartner = require('../apps/admin-portal/server/src/models/FoodmarketPartner');
const JournalEntry = require('../apps/admin-portal/server/src/models/JournalEntry');
const Account = require('../apps/admin-portal/server/src/models/Account');
const Supplier = require('../apps/admin-portal/server/src/models/Supplier');
const InventoryCategory = require('../apps/admin-portal/server/src/models/InventoryCategory');
const ModifierGroup = require('../apps/admin-portal/server/src/models/ModifierGroup');
const Customer = require('../apps/admin-portal/server/src/models/Customer');
const WastageReport = require('../apps/admin-portal/server/src/models/WastageReport');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/innovapos';

async function seed() {
  console.log(`Connecting to database at ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);

  // 1. CLEAN UP PREVIOUS DEMO RUNS
  console.log('Cleaning up previous "demo-merchant" tenant data...');
  try {
    await mongoose.connection.collection('ingredientlinks').dropIndex('tenantId_1_menuItemId_1_variantId_1_inventoryItemId_1');
    console.log('Dropped outdated ingredientlinks unique index.');
  } catch (err) {
    // Ignore if not found
  }
  const existingTenant = await Tenant.findOne({ slug: 'demo-merchant' });
  if (existingTenant) {
    const tenantId = existingTenant._id;
    await Tenant.deleteOne({ _id: tenantId });
    await Store.deleteMany({ tenantId });
    await User.deleteMany({ tenantId });
    await Inventory.deleteMany({ tenantId });
    await MenuItem.deleteMany({ tenantId });
    await IngredientLink.deleteMany({ tenantId });
    await Order.deleteMany({ tenantId });
    await StockMovement.deleteMany({ tenantId });
    await StorageArea.deleteMany({ tenantId });
    await CountSheet.deleteMany({ tenantId });
    await InventoryCountSession.deleteMany({ tenantId });
    await StockTransfer.deleteMany({ tenantId });
    await FoodmarketPartner.deleteMany({ tenantId });
    await JournalEntry.deleteMany({ tenantId });
    await Account.deleteMany({ tenantId });
    await Supplier.deleteMany({ tenantId });
    await InventoryCategory.deleteMany({ tenantId });
    await ModifierGroup.deleteMany({ tenantId });
    await Customer.deleteMany({ tenantId });
    await WastageReport.deleteMany({ tenantId });
  }

  // 2. CREATE MERCHANT TENANT
  console.log('Creating demo merchant tenant...');
  const tenant = await Tenant.create({
    slug: 'demo-merchant',
    businessName: 'Flavor Matrix QSR',
    countryIso: 'LK',
    status: 'active',
    subscriptionStatus: 'active',
    paidAddons: {
      qrOrdering: { active: true, activatedAt: new Date() },
      loyalty: { active: true, activatedAt: new Date() },
      tableManagement: { active: true, activatedAt: new Date() },
      uberEats: { active: true, activatedAt: new Date() },
      accounting: { active: true, activatedAt: new Date() },
      dualScreen: { active: true, activatedAt: new Date() },
      whatsapp: { active: true, activatedAt: new Date() },
      modifierGroups: { active: true, activatedAt: new Date() },
      advancedInventory: { active: true, activatedAt: new Date() }
    }
  });
  const tenantId = tenant._id;

  // 3. CREATE STORES
  console.log('Creating 4 stores (1 Central Kitchen + 3 Retail branches)...');
  const ckStore = await Store.create({
    tenantId,
    name: 'Flavor Matrix Central Kitchen',
    code: 'CK-COL',
    isCentralKitchen: true,
    isActive: true,
    address: { street: '100 Central Road', city: 'Colombo 10', country: 'Sri Lanka' }
  });

  const fortStore = await Store.create({
    tenantId,
    name: 'Flavor Matrix - Colombo Fort',
    code: 'ST-FORT',
    isCentralKitchen: false,
    isActive: true,
    address: { street: '12 Galle Road', city: 'Colombo 01', country: 'Sri Lanka' }
  });

  const kndyStore = await Store.create({
    tenantId,
    name: 'Flavor Matrix - Kandy Mall',
    code: 'ST-KNDY',
    isCentralKitchen: false,
    isActive: true,
    address: { street: '20 Peradeniya Rd', city: 'Kandy', country: 'Sri Lanka' }
  });

  const galeStore = await Store.create({
    tenantId,
    name: 'Flavor Matrix - Galle Fort',
    code: 'ST-GALE',
    isCentralKitchen: false,
    isActive: true,
    address: { street: '45 Lighthouse St', city: 'Galle', country: 'Sri Lanka' }
  });

  const stores = [ckStore, fortStore, kndyStore, galeStore];
  const retailStores = [fortStore, kndyStore, galeStore];

  // 4. CREATE USERS
  console.log('Creating staff users...');
  const adminUser = await User.create({
    tenantId,
    name: 'Merchant Admin',
    email: 'admin@flavormatrix.com',
    password: 'demo123',
    role: 'merchant_admin',
    storeIds: stores.map(s => s._id),
    defaultStoreId: ckStore._id
  });

  const clerkUser = await User.create({
    tenantId,
    name: 'Inventory Clerk',
    email: 'clerk@flavormatrix.com',
    password: 'demo123',
    role: 'inventory_clerk',
    storeIds: stores.map(s => s._id),
    defaultStoreId: fortStore._id
  });

  // 5. CREATE SUPPLIERS & FOODMARKET PARTNERS & STORAGE AREAS
  console.log('Creating suppliers, foodmarket partners, and storage areas...');
  const supplierKeells = await Supplier.create({
    tenantId,
    name: 'Keells Wholesale',
    contactPerson: 'Kasun Perera',
    email: 'kasun@keellswholesale.lk',
    phone: '+94771234567',
    address: '234 D.R. Wijewardena Mawatha, Colombo 10'
  });

  const supplierCargills = await Supplier.create({
    tenantId,
    name: 'Cargills Distributor',
    contactPerson: 'Dilhani Silva',
    email: 'sales@cargillsdistributors.lk',
    phone: '+94777654321',
    address: '40 York Street, Colombo 01'
  });

  const partnerUber = await FoodmarketPartner.create({
    tenantId,
    name: 'Uber Eats',
    commissionType: 'percentage',
    commissionPercentage: 30,
    isActive: true,
    icon: '🛵',
    color: '#06c167'
  });

  const partnerPickMe = await FoodmarketPartner.create({
    tenantId,
    name: 'PickMe Food',
    commissionType: 'percentage',
    commissionPercentage: 25,
    isActive: true,
    icon: '🚗',
    color: '#ffdd00'
  });

  const storageAreasByStore = {};
  for (const store of stores) {
    const freezer = await StorageArea.create({ tenantId, storeId: store._id, name: 'Walk-in Freezer' });
    const pantry = await StorageArea.create({ tenantId, storeId: store._id, name: 'Dry Pantry' });
    const counter = await StorageArea.create({ tenantId, storeId: store._id, name: 'Front Counter Bar' });
    storageAreasByStore[store._id.toString()] = { freezer, pantry, counter };
  }

  // 6. CREATE INVENTORY CATEGORIES
  const catRaw = await InventoryCategory.create({ tenantId, name: 'Raw Materials' });
  const catPrep = await InventoryCategory.create({ tenantId, name: 'Prep Batches' });

  // 7. CREATE ACCOUNTS FOR JOURNAL ENTRIES
  console.log('Seeding standard accounting accounts...');
  const accCash = await Account.create({ tenantId, code: '1000', name: 'Cash & Cash Equivalents', type: 'asset', isSystem: true });
  const accInventory = await Account.create({ tenantId, code: '1200', name: 'Inventory Asset', type: 'asset', isSystem: true });
  const accRevenue = await Account.create({ tenantId, code: '4000', name: 'Sales Revenue', type: 'revenue', isSystem: true });
  const accCogs = await Account.create({ tenantId, code: '5000', name: 'Cost of Goods Sold (COGS)', type: 'expense', isSystem: true });
  const accWastage = await Account.create({ tenantId, code: '5100', name: 'Wastage Expense', type: 'expense', isSystem: true });

  // 8. CREATE INVENTORY ITEMS FOR EACH STORE
  console.log('Creating inventory items & setting initial stock...');
  const inventoryItemsByStore = {}; // storeId -> itemName -> InventoryItemDoc

  const rawItemDefinitions = [
    { name: 'Espresso Beans', unit: 'kg', pUnit: 'Bag', sUnit: 'kg', rUnit: 'g', pMult: 1, sMult: 1000, price: 3200, threshold: 5, supplier: supplierCargills, areas: ['Dry Pantry'] },
    { name: 'Whole Milk', unit: 'L', pUnit: 'Crate', sUnit: 'L', rUnit: 'ml', pMult: 12, sMult: 1000, price: 450, threshold: 10, supplier: supplierKeells, areas: ['Walk-in Freezer'] },
    { name: 'Vanilla Syrup', unit: 'L', pUnit: 'Bottle', sUnit: 'L', rUnit: 'ml', pMult: 1, sMult: 1000, price: 1800, threshold: 3, supplier: supplierKeells, areas: ['Dry Pantry'] },
    { name: 'Ground Beef', unit: 'kg', pUnit: 'Box', sUnit: 'kg', rUnit: 'g', pMult: 10, sMult: 1000, price: 2400, threshold: 15, supplier: supplierKeells, areas: ['Walk-in Freezer'] },
    { name: 'Brioche Buns', unit: 'pcs', pUnit: 'Tray', sUnit: 'pcs', rUnit: 'pcs', pMult: 24, sMult: 1, price: 90, threshold: 50, supplier: supplierCargills, areas: ['Dry Pantry'] },
    { name: 'Cheddar Cheese', unit: 'kg', pUnit: 'Wheel', sUnit: 'kg', rUnit: 'g', pMult: 5, sMult: 1000, price: 4800, threshold: 4, supplier: supplierCargills, areas: ['Walk-in Freezer'] }
  ];

  for (const store of stores) {
    inventoryItemsByStore[store._id.toString()] = {};
    const areas = storageAreasByStore[store._id.toString()];

    // Generate Raw Items
    for (const def of rawItemDefinitions) {
      const initQty = store.isCentralKitchen ? 200 : 50; // Central kitchen starts with more stock
      const item = await Inventory.create({
        tenantId,
        storeId: store._id,
        itemName: def.name,
        unit: def.unit,
        purchaseUnit: def.pUnit,
        storageUnit: def.sUnit,
        recipeUnit: def.rUnit,
        purchaseToStorageMultiplier: def.pMult,
        storageToRecipeMultiplier: def.sMult,
        itemType: 'raw',
        quantity: initQty,
        minThreshold: def.threshold,
        suppliers: [def.supplier._id],
        category: catRaw._id,
        storageAreas: def.areas,
        lastCost: def.price,
        wacCost: def.price,
        fifoCost: def.price,
        createdBy: adminUser._id,
        supplierCatalog: [{
          supplierId: def.supplier._id,
          purchasePrice: def.price * def.pMult,
          moq: 1
        }]
      });

      // Record Opening Stock Movement
      await StockMovement.create({
        tenantId,
        storeId: store._id,
        inventoryItemId: item._id,
        type: 'opening',
        quantity: initQty,
        previousQty: 0,
        newQty: initQty,
        reason: 'Initial Opening Stock setup',
        createdBy: adminUser._id
      });

      inventoryItemsByStore[store._id.toString()][def.name] = item;
    }
  }

  // Generate Prepared Prep items
  for (const store of stores) {
    const storeIdStr = store._id.toString();
    const items = inventoryItemsByStore[storeIdStr];

    // Prep 1: Espresso Shot (uses 15g Espresso Beans)
    const espShot = await Inventory.create({
      tenantId,
      storeId: store._id,
      itemName: 'Espresso Shot',
      unit: 'Shot',
      purchaseUnit: 'Shot',
      storageUnit: 'Shot',
      recipeUnit: 'Shot',
      purchaseToStorageMultiplier: 1,
      storageToRecipeMultiplier: 1,
      itemType: 'prep',
      quantity: store.isCentralKitchen ? 500 : 100,
      minThreshold: 20,
      category: catPrep._id,
      storageAreas: ['Front Counter Bar'],
      lastCost: 48, // 15g * 3.2 LKR/g
      wacCost: 48,
      createdBy: adminUser._id,
      recipe: [{
        inventoryItemId: items['Espresso Beans']._id,
        quantity: 15 // 15g
      }]
    });
    items['Espresso Shot'] = espShot;

    // Prep 2: Vanilla Sweet Cream (uses 800ml Milk + 100ml Vanilla Syrup)
    const sweetCream = await Inventory.create({
      tenantId,
      storeId: store._id,
      itemName: 'Vanilla Sweet Cream',
      unit: 'L',
      purchaseUnit: 'Jug',
      storageUnit: 'L',
      recipeUnit: 'ml',
      purchaseToStorageMultiplier: 1,
      storageToRecipeMultiplier: 1000,
      itemType: 'prep',
      quantity: store.isCentralKitchen ? 50 : 15,
      minThreshold: 2,
      category: catPrep._id,
      storageAreas: ['Walk-in Freezer'],
      lastCost: 540, // 0.8 * 450 + 0.1 * 1800
      wacCost: 540,
      createdBy: adminUser._id,
      recipe: [
        { inventoryItemId: items['Whole Milk']._id, quantity: 800 },
        { inventoryItemId: items['Vanilla Syrup']._id, quantity: 100 }
      ]
    });
    items['Vanilla Sweet Cream'] = sweetCream;

    // Prep 3: Beef Patty (Prep) (uses 150g Ground Beef)
    const beefPatty = await Inventory.create({
      tenantId,
      storeId: store._id,
      itemName: 'Beef Patty (Prep)',
      unit: 'pcs',
      purchaseUnit: 'Tray',
      storageUnit: 'pcs',
      recipeUnit: 'pcs',
      purchaseToStorageMultiplier: 1,
      storageToRecipeMultiplier: 1,
      itemType: 'prep',
      quantity: store.isCentralKitchen ? 200 : 40,
      minThreshold: 10,
      category: catPrep._id,
      storageAreas: ['Walk-in Freezer'],
      lastCost: 360, // 0.150 * 2400
      wacCost: 360,
      createdBy: adminUser._id,
      recipe: [{
        inventoryItemId: items['Ground Beef']._id,
        quantity: 150 // 150g
      }]
    });
    items['Beef Patty (Prep)'] = beefPatty;
  }

  // 9. CREATE MODIFIER GROUPS & MODIFIER OPTIONS
  console.log('Seeding modifier groups and options...');
  const modToppings = await ModifierGroup.create({
    tenantId,
    name: 'Burger Add-ons',
    description: 'Customize your premium burger toppings',
    minSelections: 0,
    maxSelections: 4,
    modifiers: [
      { name: 'Extra Cheddar Cheese', price: 150, available: true },
      { name: 'Crispy Onion Strings', price: 100, available: true }
    ]
  });

  const cheeseModifierId = modToppings.modifiers.find(m => m.name === 'Extra Cheddar Cheese')._id;

  // 10. CREATE MENU ITEMS
  console.log('Creating Menu items...');
  const itemBurger = await MenuItem.create({
    tenantId,
    name: 'Double Cheddar Burger',
    category: 'Mains',
    price: 1850,
    description: 'Two beef patties with melted cheddar cheese on toasted brioche bun.',
    available: true,
    modifierGroups: [{ modifierGroupId: modToppings._id }]
  });

  const itemLatte = await MenuItem.create({
    tenantId,
    name: 'Vanilla Latte',
    category: 'Beverages',
    price: 850,
    description: 'Vanilla flavored creamy latte made with fresh espresso shots.',
    available: true
  });

  // 11. CREATE INGREDIENT LINKS
  console.log('Creating ingredient links / recipes for menu items...');
  // Burger recipe: 2x Beef Patty (Prep), 1x Brioche Bun, 50g Cheddar Cheese
  await IngredientLink.create({
    tenantId,
    menuItemId: itemBurger._id,
    inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Beef Patty (Prep)']._id,
    quantity: 2,
    unit: 'pcs',
    createdBy: adminUser._id
  });
  await IngredientLink.create({
    tenantId,
    menuItemId: itemBurger._id,
    inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Brioche Buns']._id,
    quantity: 1,
    unit: 'pcs',
    createdBy: adminUser._id
  });
  await IngredientLink.create({
    tenantId,
    menuItemId: itemBurger._id,
    inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Cheddar Cheese']._id,
    quantity: 50, // 50g
    unit: 'g',
    createdBy: adminUser._id
  });

  // Extra cheese modifier link: 25g Cheddar Cheese
  await IngredientLink.create({
    tenantId,
    menuItemId: itemBurger._id,
    modifierId: cheeseModifierId,
    inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Cheddar Cheese']._id,
    quantity: 25, // 25g
    unit: 'g',
    createdBy: adminUser._id
  });

  // Latte recipe: 1x Espresso Shot, 250ml Milk, 30ml Vanilla Syrup
  await IngredientLink.create({
    tenantId,
    menuItemId: itemLatte._id,
    inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Espresso Shot']._id,
    quantity: 1,
    unit: 'Shot',
    createdBy: adminUser._id
  });
  await IngredientLink.create({
    tenantId,
    menuItemId: itemLatte._id,
    inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Whole Milk']._id,
    quantity: 250, // 250ml
    unit: 'ml',
    createdBy: adminUser._id
  });
  await IngredientLink.create({
    tenantId,
    menuItemId: itemLatte._id,
    inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Vanilla Syrup']._id,
    quantity: 30, // 30ml
    unit: 'ml',
    createdBy: adminUser._id
  });

  // 12. CREATE A COUNT SHEET
  console.log('Seeding Shelf-to-sheet inventory count sheets...');
  const countSheet = await CountSheet.create({
    tenantId,
    storeId: fortStore._id,
    name: 'Weekly Shelf Count',
    storageAreas: ['Walk-in Freezer', 'Dry Pantry', 'Front Counter Bar'],
    items: [
      { inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Espresso Beans']._id, displayOrder: 0 },
      { inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Whole Milk']._id, displayOrder: 1 },
      { inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Vanilla Syrup']._id, displayOrder: 2 },
      { inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Beef Patty (Prep)']._id, displayOrder: 3 }
    ]
  });

  // 13. GENERATE 14 DAYS OF HISTORICAL TRANSACTIONS, STOCK MOVEMENT, TRANSFERS AND JOURNAL ENTRIES
  console.log('Generating 14 days of realistic transaction logs and inventory activities...');
  const startDay = new Date();
  startDay.setDate(startDay.getDate() - 14);

  let orderCounter = 1000;
  let transferCounter = 500;

  for (let d = 0; d <= 14; d++) {
    const currentDay = new Date(startDay);
    currentDay.setDate(startDay.getDate() + d);

    console.log(`- Generating data for ${currentDay.toISOString().split('T')[0]}`);

    // (A) Daily Transfers from Central Kitchen (CK-COL) to Retail Branches
    if (d % 3 === 0) { // Every 3 days, dispatch supplies
      for (const store of retailStores) {
        transferCounter++;
        const transferItems = [
          {
            inventoryItemId: inventoryItemsByStore[ckStore._id.toString()]['Beef Patty (Prep)']._id,
            qtySent: 40,
            qtyReceived: 40,
            unit: 'pcs'
          },
          {
            inventoryItemId: inventoryItemsByStore[ckStore._id.toString()]['Whole Milk']._id,
            qtySent: 24, // 2 crates
            qtyReceived: 24,
            unit: 'L'
          }
        ];

        // Create the received transfer
        await StockTransfer.create({
          tenantId,
          sourceStoreId: ckStore._id,
          targetStoreId: store._id,
          transferNumber: `TR-${transferCounter}`,
          status: 'received',
          items: transferItems,
          shippedAt: new Date(currentDay.getTime() - 2 * 60 * 60 * 1000),
          receivedAt: currentDay,
          notes: 'Regular replenishment batch',
          createdBy: adminUser._id,
          receivedBy: clerkUser._id
        });

        // Deduct from CK and add to Retail Store
        for (const item of transferItems) {
          const ckItemName = item.inventoryItemId.toString() === inventoryItemsByStore[ckStore._id.toString()]['Beef Patty (Prep)']._id.toString() ? 'Beef Patty (Prep)' : 'Whole Milk';
          
          const ckInv = inventoryItemsByStore[ckStore._id.toString()][ckItemName];
          const oldCk = ckInv.quantity;
          ckInv.quantity = Math.max(0, oldCk - item.qtySent);
          await ckInv.save();
          await StockMovement.create({
            tenantId,
            storeId: ckStore._id,
            inventoryItemId: ckInv._id,
            type: 'adjustment',
            quantity: -item.qtySent,
            previousQty: oldCk,
            newQty: ckInv.quantity,
            reason: `Transfer TR-${transferCounter} dispatch`,
            createdBy: adminUser._id
          });

          const branchInv = inventoryItemsByStore[store._id.toString()][ckItemName];
          const oldBranch = branchInv.quantity;
          branchInv.quantity = oldBranch + item.qtyReceived;
          await branchInv.save();
          await StockMovement.create({
            tenantId,
            storeId: store._id,
            inventoryItemId: branchInv._id,
            type: 'adjustment',
            quantity: item.qtyReceived,
            previousQty: oldBranch,
            newQty: branchInv.quantity,
            reason: `Transfer TR-${transferCounter} receipt`,
            createdBy: clerkUser._id
          });
        }
      }
    }

    // (B) Daily Sales Orders for each retail store
    for (const store of retailStores) {
      const storeIdStr = store._id.toString();
      const numOrders = Math.floor(Math.random() * 8) + 6; // 6 to 13 orders per day

      for (let o = 0; o < numOrders; o++) {
        orderCounter++;
        const hour = Math.floor(Math.random() * 12) + 9; // 9 AM to 9 PM
        const orderTime = new Date(currentDay);
        orderTime.setHours(hour, Math.floor(Math.random() * 60));

        // Create order item structure
        const burgerQty = Math.floor(Math.random() * 3) + 1; // 1 to 3 burgers
        const latteQty = Math.floor(Math.random() * 2) + 1; // 1 to 2 lattes
        const extraCheese = Math.random() > 0.4; // 60% chance of extra cheese modifier

        const itemsList = [
          {
            menuItem: itemBurger._id,
            name: itemBurger.name,
            category: itemBurger.category,
            qty: burgerQty,
            price: itemBurger.price,
            modifiers: extraCheese ? [{
              modifierGroupId: modToppings._id,
              modifierId: cheeseModifierId,
              name: 'Extra Cheddar Cheese',
              price: 150,
              qty: burgerQty
            }] : []
          },
          {
            menuItem: itemLatte._id,
            name: itemLatte.name,
            category: itemLatte.category,
            qty: latteQty,
            price: itemLatte.price
          }
        ];

        const subtotal = (burgerQty * 1850) + (latteQty * 850) + (extraCheese ? burgerQty * 150 : 0);
        const taxAmount = Math.round(subtotal * 0.08); // 8% tax
        const totalAmount = subtotal + taxAmount;

        const source = Math.random() > 0.75 ? 'qr' : 'pos';
        const partner = Math.random() > 0.8 ? (Math.random() > 0.5 ? partnerUber : partnerPickMe) : null;

        const order = await Order.create({
          tenantId,
          storeId: store._id,
          orderNumber: orderCounter,
          orderType: partner ? 'delivery' : (source === 'qr' ? 'table-service' : 'dine-in'),
          items: itemsList,
          status: 'completed',
          subtotal,
          taxRate: 8,
          taxAmount,
          totalAmount,
          orderSource: source,
          paymentType: 'cash',
          paymentAmount: totalAmount,
          paymentCollected: true,
          foodmarketPartnerId: partner ? partner._id : null,
          commissionAmount: partner ? Math.round(subtotal * (partner.commissionPercentage / 100)) : 0,
          createdAt: orderTime,
          updatedAt: orderTime
        });

        // (C) Stock depletion for this sales order
        let calculatedCogs = 0;

        // Burger ingredients
        const burgerPattyItem = inventoryItemsByStore[storeIdStr]['Beef Patty (Prep)'];
        const bunItem = inventoryItemsByStore[storeIdStr]['Brioche Buns'];
        const cheeseItem = inventoryItemsByStore[storeIdStr]['Cheddar Cheese'];

        // Patty deduction (2 per burger)
        const pattyDeduct = burgerQty * 2;
        calculatedCogs += pattyDeduct * burgerPattyItem.wacCost;
        const oldPattyQty = burgerPattyItem.quantity;
        burgerPattyItem.quantity = Math.max(0, oldPattyQty - pattyDeduct);
        await burgerPattyItem.save();
        await StockMovement.create({
          tenantId,
          storeId: store._id,
          inventoryItemId: burgerPattyItem._id,
          type: 'adjustment',
          quantity: -pattyDeduct,
          previousQty: oldPattyQty,
          newQty: burgerPattyItem.quantity,
          reason: `Sales Order #${orderCounter} depletion`,
          createdBy: adminUser._id,
          createdAt: orderTime
        });

        // Bun deduction (1 per burger)
        const bunDeduct = burgerQty;
        calculatedCogs += bunDeduct * bunItem.wacCost;
        const oldBunQty = bunItem.quantity;
        bunItem.quantity = Math.max(0, oldBunQty - bunDeduct);
        await bunItem.save();
        await StockMovement.create({
          tenantId,
          storeId: store._id,
          inventoryItemId: bunItem._id,
          type: 'adjustment',
          quantity: -bunDeduct,
          previousQty: oldBunQty,
          newQty: bunItem.quantity,
          reason: `Sales Order #${orderCounter} depletion`,
          createdBy: adminUser._id,
          createdAt: orderTime
        });

        // Cheese deduction (50g per burger + optional 25g modifier)
        const cheeseDeduct = (burgerQty * 50) + (extraCheese ? burgerQty * 25 : 0); // in grams
        const cheeseDeductKg = cheeseDeduct / 1000;
        calculatedCogs += cheeseDeductKg * cheeseItem.wacCost;
        const oldCheeseQty = cheeseItem.quantity;
        cheeseItem.quantity = Math.max(0, oldCheeseQty - cheeseDeductKg);
        await cheeseItem.save();
        await StockMovement.create({
          tenantId,
          storeId: store._id,
          inventoryItemId: cheeseItem._id,
          type: 'adjustment',
          quantity: -cheeseDeductKg,
          previousQty: oldCheeseQty,
          newQty: cheeseItem.quantity,
          reason: `Sales Order #${orderCounter} depletion`,
          createdBy: adminUser._id,
          createdAt: orderTime
        });

        // Latte ingredients
        const shotItem = inventoryItemsByStore[storeIdStr]['Espresso Shot'];
        const milkItem = inventoryItemsByStore[storeIdStr]['Whole Milk'];
        const syrupItem = inventoryItemsByStore[storeIdStr]['Vanilla Syrup'];

        // Espresso Shot deduction (1 shot per latte)
        const shotDeduct = latteQty;
        calculatedCogs += shotDeduct * shotItem.wacCost;
        const oldShotQty = shotItem.quantity;
        shotItem.quantity = Math.max(0, oldShotQty - shotDeduct);
        await shotItem.save();
        await StockMovement.create({
          tenantId,
          storeId: store._id,
          inventoryItemId: shotItem._id,
          type: 'adjustment',
          quantity: -shotDeduct,
          previousQty: oldShotQty,
          newQty: shotItem.quantity,
          reason: `Sales Order #${orderCounter} depletion`,
          createdBy: adminUser._id,
          createdAt: orderTime
        });

        // Whole Milk deduction (250ml per latte)
        const milkDeductL = (latteQty * 250) / 1000;
        calculatedCogs += milkDeductL * milkItem.wacCost;
        const oldMilkQty = milkItem.quantity;
        milkItem.quantity = Math.max(0, oldMilkQty - milkDeductL);
        await milkItem.save();
        await StockMovement.create({
          tenantId,
          storeId: store._id,
          inventoryItemId: milkItem._id,
          type: 'adjustment',
          quantity: -milkDeductL,
          previousQty: oldMilkQty,
          newQty: milkItem.quantity,
          reason: `Sales Order #${orderCounter} depletion`,
          createdBy: adminUser._id,
          createdAt: orderTime
        });

        // Syrup deduction (30ml per latte)
        const syrupDeductL = (latteQty * 30) / 1000;
        calculatedCogs += syrupDeductL * syrupItem.wacCost;
        const oldSyrupQty = syrupItem.quantity;
        syrupItem.quantity = Math.max(0, oldSyrupQty - syrupDeductL);
        await syrupItem.save();
        await StockMovement.create({
          tenantId,
          storeId: store._id,
          inventoryItemId: syrupItem._id,
          type: 'adjustment',
          quantity: -syrupDeductL,
          previousQty: oldSyrupQty,
          newQty: syrupItem.quantity,
          reason: `Sales Order #${orderCounter} depletion`,
          createdBy: adminUser._id,
          createdAt: orderTime
        });

        // (D) Double Entry Journal Recording
        await JournalEntry.create({
          tenantId,
          storeId: store._id,
          date: orderTime,
          reference: `Order #${order.orderNumber}`,
          referenceModel: 'Order',
          description: `Sales revenue and COGS for Order #${order.orderNumber}`,
          createdBy: adminUser._id,
          lines: [
            // Sales revenue lines
            { accountId: accCash._id, debit: totalAmount, credit: 0, description: 'Cash collected' },
            { accountId: accRevenue._id, debit: 0, credit: totalAmount, description: 'Sales Revenue' },
            // Inventory cost lines
            { accountId: accCogs._id, debit: Math.round(calculatedCogs), credit: 0, description: 'Cost of Goods Sold' },
            { accountId: accInventory._id, debit: 0, credit: Math.round(calculatedCogs), description: 'Inventory stock depletion' }
          ]
        });
      }
    }

    // (E) EOD Spillage/Wastage events
    if (d % 4 === 2) {
      for (const store of retailStores) {
        const storeIdStr = store._id.toString();
        const milkItem = inventoryItemsByStore[storeIdStr]['Whole Milk'];
        const oldQty = milkItem.quantity;

        // Waste 2 liters of Whole Milk
        milkItem.quantity = Math.max(0, oldQty - 2);
        await milkItem.save();

        await WastageReport.create({
          tenantId,
          storeId: store._id,
          date: currentDay,
          type: 'spill_expiry_damage',
          notes: 'Milk box leakage in cold storage room',
          createdBy: clerkUser._id,
          items: [{
            itemType: 'inventory',
            inventoryItemId: milkItem._id,
            quantity: 2,
            reason: 'spillage'
          }]
        });

        await StockMovement.create({
          tenantId,
          storeId: store._id,
          inventoryItemId: milkItem._id,
          type: 'waste',
          quantity: -2,
          previousQty: oldQty,
          newQty: milkItem.quantity,
          reason: 'Spilled / damaged in walk-in fridge',
          createdBy: clerkUser._id,
          createdAt: currentDay
        });

        // Accounting Journal for Wastage
        const wastageCost = Math.round(2 * milkItem.wacCost);
        await JournalEntry.create({
          tenantId,
          storeId: store._id,
          date: currentDay,
          reference: 'EOD Wastage',
          referenceModel: 'Manual',
          description: 'Inventory wastage write-off',
          createdBy: clerkUser._id,
          lines: [
            { accountId: accWastage._id, debit: wastageCost, credit: 0, description: 'Wastage expense' },
            { accountId: accInventory._id, debit: 0, credit: wastageCost, description: 'Inventory asset depletion' }
          ]
        });
      }
    }

    // (F) Semi-Weekly Stocktake Sessions (E.g. Sunday counts)
    if (d === 7 || d === 14) {
      for (const store of retailStores) {
        const storeIdStr = store._id.toString();
        const milk = inventoryItemsByStore[storeIdStr]['Whole Milk'];
        const buns = inventoryItemsByStore[storeIdStr]['Brioche Buns'];

        // Start stocktake count session
        const session = await InventoryCountSession.create({
          tenantId,
          storeId: store._id,
          countSheetId: countSheet._id,
          status: 'closed',
          userId: clerkUser._id,
          notes: `EOD Stocktake Audit Week ${d === 7 ? '1' : '2'}`,
          endedAt: currentDay,
          items: [
            {
              inventoryItemId: milk._id,
              theoreticalQty: milk.quantity,
              countedQty: Math.max(0, Math.round(milk.quantity - (Math.random() * 0.5))), // Tiny variance
              costPrice: milk.wacCost
            },
            {
              inventoryItemId: buns._id,
              theoreticalQty: buns.quantity,
              countedQty: buns.quantity, // Zero variance
              costPrice: buns.wacCost
            }
          ]
        });

        // Record stock movements for any discrepancies found
        for (const sessionItem of session.items) {
          const variance = sessionItem.countedQty - sessionItem.theoreticalQty;
          if (variance !== 0) {
            const invDoc = inventoryItemsByStore[storeIdStr][sessionItem.inventoryItemId.toString() === milk._id.toString() ? 'Whole Milk' : 'Brioche Buns'];
            const oldQty = invDoc.quantity;
            invDoc.quantity = sessionItem.countedQty;
            await invDoc.save();

            await StockMovement.create({
              tenantId,
              storeId: store._id,
              inventoryItemId: invDoc._id,
              sessionId: session._id,
              type: 'adjustment',
              quantity: variance,
              previousQty: oldQty,
              newQty: sessionItem.countedQty,
              reason: 'Audit stocktake variance adjustment',
              createdBy: clerkUser._id,
              createdAt: currentDay
            });
          }
        }
      }
    }
  }

  console.log('\n=========================================');
  console.log('DEMO MERCHANT SEEDING COMPLETED SUCCESSFULLY!');
  console.log('=========================================');
  console.log(`Tenant Slug:      demo-merchant`);
  console.log(`Business Name:    ${tenant.businessName}`);
  console.log(`Plan Details:     All Addons Active (Including Advanced Inventory & Accounting)`);
  console.log(`Stores Created:   4 (${stores.map(s => `${s.name} [${s.code}]`).join(', ')})`);
  console.log(`Users Provisioned:`);
  console.log(`  - Admin:        admin@flavormatrix.com  / password: demo123`);
  console.log(`  - Clerk:        clerk@flavormatrix.com  / password: demo123`);
  console.log(`Transactions:     ~150 completed POS & QR orders across stores`);
  console.log(`Inventory Items:  Espresso Beans, Milk, Syrup, Buns, Cheese, Beef Patties`);
  console.log(`Transfers:        Inter-store CK-to-branch Stock Transfers`);
  console.log(`Wastage Logs:     Leaking boxes, damage events, spillage`);
  console.log(`Journal Entries:  Double-entry ledger records for every sale & wastage`);
  console.log('=========================================\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('Error during demo seeding:', err);
  process.exit(1);
});
