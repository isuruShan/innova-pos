'use strict';

/**
 * Splitsecond POS & Admin Portal - Ultimate Demo Merchant Seeding Script
 * Usage: node scratch/seed-demo-merchant.js
 */

require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

// Models
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
const CafeTable = require('../apps/admin-portal/server/src/models/CafeTable');
const FloorPlan = require('../apps/admin-portal/server/src/models/FloorPlan');
const PurchaseOrder = require('../apps/admin-portal/server/src/models/PurchaseOrder');
const GoodsReceipt = require('../apps/admin-portal/server/src/models/GoodsReceipt');

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
    await CafeTable.deleteMany({ tenantId });
    await FloorPlan.deleteMany({ tenantId });
    await PurchaseOrder.deleteMany({ tenantId });
    await GoodsReceipt.deleteMany({ tenantId });
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

  // 4. CREATE USERS (ALL ROLES)
  console.log('Creating staff users for all roles...');
  const adminUser = await User.create({
    tenantId,
    name: 'Merchant Admin',
    email: 'admin@flavormatrix.com',
    password: 'demo123',
    role: 'merchant_admin',
    storeIds: stores.map(s => s._id),
    defaultStoreId: ckStore._id
  });

  const managerUser = await User.create({
    tenantId,
    name: 'Store Manager',
    email: 'manager@flavormatrix.com',
    password: 'demo123',
    role: 'manager',
    storeIds: retailStores.map(s => s._id),
    defaultStoreId: fortStore._id
  });

  const cashierUser = await User.create({
    tenantId,
    name: 'Senior Cashier',
    email: 'cashier@flavormatrix.com',
    password: 'demo123',
    role: 'cashier',
    storeIds: [fortStore._id],
    defaultStoreId: fortStore._id
  });

  const kitchenUser = await User.create({
    tenantId,
    name: 'Head Chef',
    email: 'kitchen@flavormatrix.com',
    password: 'demo123',
    role: 'kitchen',
    storeIds: [fortStore._id],
    defaultStoreId: fortStore._id
  });

  const stewardUser = await User.create({
    tenantId,
    name: 'Lead Steward',
    email: 'steward@flavormatrix.com',
    password: 'demo123',
    role: 'steward',
    storeIds: [fortStore._id],
    defaultStoreId: fortStore._id
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

  const operatorUser = await User.create({
    tenantId,
    name: 'Commissary Operator',
    email: 'operator@flavormatrix.com',
    password: 'demo123',
    role: 'commissary_operator',
    storeIds: [ckStore._id],
    defaultStoreId: ckStore._id
  });

  const purchaserUser = await User.create({
    tenantId,
    name: 'Purchasing Officer',
    email: 'purchaser@flavormatrix.com',
    password: 'demo123',
    role: 'purchasing_officer',
    storeIds: stores.map(s => s._id),
    defaultStoreId: ckStore._id
  });

  // 5. CREATE TABLE PLANS (At least 10 tables per store)
  console.log('Seeding table plans and dining layouts for stores...');
  const tablesByStore = {};
  for (const store of retailStores) {
    const storeTables = [];
    for (let i = 1; i <= 12; i++) {
      const table = await CafeTable.create({
        tenantId,
        storeId: store._id,
        label: `T-${i}`,
        sortOrder: i,
        active: true,
        assignedSteward: stewardUser._id
      });
      storeTables.push(table);
    }
    tablesByStore[store._id.toString()] = storeTables;

    // Create Floor plan document linking the tables
    await FloorPlan.create({
      tenantId,
      storeId: store._id,
      name: 'Main Dining Hall',
      tables: storeTables.map((t, idx) => ({
        tableId: t._id,
        x: (idx % 4) * 4 + 2,
        y: Math.floor(idx / 4) * 4 + 2,
        width: 2,
        height: 2,
        shape: idx % 3 === 0 ? 'round' : 'rectangle',
        capacity: idx % 2 === 0 ? 4 : 2
      })),
      zones: [
        { name: 'AC Hall', color: '#3b82f6', x: 1, y: 1, width: 10, height: 12 },
        { name: 'Outdoor Deck', color: '#10b981', x: 11, y: 1, width: 9, height: 12, isOutdoor: true }
      ]
    });
  }

  // 6. CREATE SUPPLIERS & FOODMARKET PARTNERS
  console.log('Creating suppliers and foodmarket integration partners...');
  const supplierKeells = await Supplier.create({ tenantId, name: 'Keells Wholesale', contactPerson: 'Kasun Perera', email: 'kasun@keells.lk', phone: '+94771112222', address: 'Colombo' });
  const supplierCargills = await Supplier.create({ tenantId, name: 'Cargills Distributor', contactPerson: 'Dilhani Silva', email: 'sales@cargills.lk', phone: '+94772223333', address: 'Colombo' });
  const supplierLankaDairies = await Supplier.create({ tenantId, name: 'Lanka Dairies', contactPerson: 'A. Fonseka', email: 'orders@lankadairies.lk', phone: '+94773334444', address: 'Nuwara Eliya' });
  const supplierCeylonBev = await Supplier.create({ tenantId, name: 'Ceylon Beverage Co', contactPerson: 'M. Perera', email: 'bev@ceylonbev.lk', phone: '+94774445555', address: 'Kaduwela' });
  const supplierPrintPack = await Supplier.create({ tenantId, name: 'Print & Pack Sri Lanka', contactPerson: 'T. Jayaweera', email: 'pack@printpack.lk', phone: '+94775556666', address: 'Rajagiriya' });

  const suppliers = [supplierKeells, supplierCargills, supplierLankaDairies, supplierCeylonBev, supplierPrintPack];

  const partnerUber = await FoodmarketPartner.create({ tenantId, name: 'Uber Eats', commissionType: 'percentage', commissionPercentage: 30, isActive: true, icon: '🛵', color: '#06c167' });
  const partnerPickMe = await FoodmarketPartner.create({ tenantId, name: 'PickMe Food', commissionType: 'percentage', commissionPercentage: 25, isActive: true, icon: '🚗', color: '#ffdd00' });

  // 7. CREATE CUSTOMERS (At least 10)
  console.log('Creating loyal customers...');
  const customers = [];
  const customerNames = [
    { name: 'Isuru Shan', phone: '+94777123456', email: 'isuru@example.com' },
    { name: 'Nisal Mendis', phone: '+94777234567', email: 'nisal@example.com' },
    { name: 'Sanduni Perera', phone: '+94777345678', email: 'sanduni@example.com' },
    { name: 'Dilshan Silva', phone: '+94777456789', email: 'dilshan@example.com' },
    { name: 'Asha Jayasekara', phone: '+94777567890', email: 'asha@example.com' },
    { name: 'Thilan Gamage', phone: '+94777678901', email: 'thilan@example.com' },
    { name: 'Ruwan Fernando', phone: '+94777789012', email: 'ruwan@example.com' },
    { name: 'Minoli Wijesinghe', phone: '+94777890123', email: 'minoli@example.com' },
    { name: 'Pathum Nissanka', phone: '+94777901234', email: 'pathum@example.com' },
    { name: 'Gayani Cooray', phone: '+94777012345', email: 'gayani@example.com' }
  ];

  for (const c of customerNames) {
    const customer = await Customer.create({
      tenantId,
      name: c.name,
      mobile: c.phone,
      email: c.email,
      lifetimePoints: 120,
      createdBy: adminUser._id
    });
    customers.push(customer);
  }

  // 8. STORAGE AREAS & INVENTORY CATEGORIES
  const storageAreasByStore = {};
  for (const store of stores) {
    const freezer = await StorageArea.create({ tenantId, storeId: store._id, name: 'Walk-in Freezer' });
    const pantry = await StorageArea.create({ tenantId, storeId: store._id, name: 'Dry Pantry' });
    const counter = await StorageArea.create({ tenantId, storeId: store._id, name: 'Front Counter Bar' });
    storageAreasByStore[store._id.toString()] = { freezer, pantry, counter };
  }

  const catRaw = await InventoryCategory.create({ tenantId, name: 'Raw Materials' });
  const catPrep = await InventoryCategory.create({ tenantId, name: 'Prep Batches' });
  const catPack = await InventoryCategory.create({ tenantId, name: 'Packaging' });

  // 9. CREATE ACCOUNTS FOR JOURNAL ENTRIES
  const accCash = await Account.create({ tenantId, code: '1000', name: 'Cash & Cash Equivalents', type: 'asset', isSystem: true });
  const accInventory = await Account.create({ tenantId, code: '1200', name: 'Inventory Asset', type: 'asset', isSystem: true });
  const accRevenue = await Account.create({ tenantId, code: '4000', name: 'Sales Revenue', type: 'revenue', isSystem: true });
  const accCogs = await Account.create({ tenantId, code: '5000', name: 'Cost of Goods Sold (COGS)', type: 'expense', isSystem: true });
  const accWastage = await Account.create({ tenantId, code: '5100', name: 'Wastage Expense', type: 'expense', isSystem: true });

  // 10. SEED INVENTORY ITEMS (Raw & Prep sub-recipes)
  console.log('Seeding raw and prepared inventory items...');
  const inventoryItemsByStore = {}; // storeId -> itemName -> InventoryItemDoc

  const rawItemDefinitions = [
    { name: 'Espresso Beans', unit: 'kg', pUnit: 'Bag', sUnit: 'kg', rUnit: 'g', pMult: 1, sMult: 1000, price: 3200, threshold: 5, supplier: supplierCeylonBev, areas: ['Dry Pantry'] },
    { name: 'Whole Milk', unit: 'L', pUnit: 'Crate', sUnit: 'L', rUnit: 'ml', pMult: 12, sMult: 1000, price: 450, threshold: 10, supplier: supplierLankaDairies, areas: ['Walk-in Freezer'] },
    { name: 'Vanilla Syrup', unit: 'L', pUnit: 'Bottle', sUnit: 'L', rUnit: 'ml', pMult: 1, sMult: 1000, price: 1800, threshold: 3, supplier: supplierKeells, areas: ['Dry Pantry'] },
    { name: 'Ground Beef', unit: 'kg', pUnit: 'Box', sUnit: 'kg', rUnit: 'g', pMult: 10, sMult: 1000, price: 2400, threshold: 15, supplier: supplierKeells, areas: ['Walk-in Freezer'] },
    { name: 'Chicken Breast', unit: 'kg', pUnit: 'Box', sUnit: 'kg', rUnit: 'g', pMult: 10, sMult: 1000, price: 1600, threshold: 15, supplier: supplierKeells, areas: ['Walk-in Freezer'] },
    { name: 'Brioche Buns', unit: 'pcs', pUnit: 'Tray', sUnit: 'pcs', rUnit: 'pcs', pMult: 24, sMult: 1, price: 90, threshold: 50, supplier: supplierCargills, areas: ['Dry Pantry'] },
    { name: 'Cheddar Cheese', unit: 'kg', pUnit: 'Wheel', sUnit: 'kg', rUnit: 'g', pMult: 5, sMult: 1000, price: 4800, threshold: 4, supplier: supplierCargills, areas: ['Walk-in Freezer'] },
    { name: 'Lettuce', unit: 'kg', pUnit: 'Box', sUnit: 'kg', rUnit: 'g', pMult: 5, sMult: 1000, price: 600, threshold: 2, supplier: supplierKeells, areas: ['Walk-in Freezer'] },
    { name: 'Tomatoes', unit: 'kg', pUnit: 'Box', sUnit: 'kg', rUnit: 'g', pMult: 5, sMult: 1000, price: 400, threshold: 2, supplier: supplierKeells, areas: ['Walk-in Freezer'] },
    { name: 'French Fries', unit: 'kg', pUnit: 'Box', sUnit: 'kg', rUnit: 'g', pMult: 10, sMult: 1000, price: 900, threshold: 10, supplier: supplierCargills, areas: ['Walk-in Freezer'] },
    { name: 'Cooking Oil', unit: 'L', pUnit: 'Can', sUnit: 'L', rUnit: 'ml', pMult: 20, sMult: 1000, price: 650, threshold: 10, supplier: supplierKeells, areas: ['Dry Pantry'] },
    { name: 'Chocolate Powder', unit: 'kg', pUnit: 'Bag', sUnit: 'kg', rUnit: 'g', pMult: 1, sMult: 1000, price: 2000, threshold: 2, supplier: supplierLankaDairies, areas: ['Dry Pantry'] },
    { name: 'Paper Cups', unit: 'pcs', pUnit: 'Box', sUnit: 'pcs', rUnit: 'pcs', pMult: 500, sMult: 1, price: 15, threshold: 100, supplier: supplierPrintPack, areas: ['Dry Pantry'] },
    { name: 'Takeaway Boxes', unit: 'pcs', pUnit: 'Box', sUnit: 'pcs', rUnit: 'pcs', pMult: 250, sMult: 1, price: 25, threshold: 50, supplier: supplierPrintPack, areas: ['Dry Pantry'] }
  ];

  for (const store of stores) {
    inventoryItemsByStore[store._id.toString()] = {};

    for (const def of rawItemDefinitions) {
      const initQty = store.isCentralKitchen ? 500 : 100; // Central Kitchen holds major raw reserves
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
        category: (def.name.includes('Cup') || def.name.includes('Box')) ? catPack._id : catRaw._id,
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

  // Seeding Prepared items
  for (const store of stores) {
    const storeIdStr = store._id.toString();
    const raw = inventoryItemsByStore[storeIdStr];

    // Espresso Shot
    const espShot = await Inventory.create({
      tenantId, storeId: store._id, itemName: 'Espresso Shot', unit: 'Shot', purchaseUnit: 'Shot', storageUnit: 'Shot', recipeUnit: 'Shot',
      purchaseToStorageMultiplier: 1, storageToRecipeMultiplier: 1, itemType: 'prep', quantity: store.isCentralKitchen ? 1000 : 200,
      minThreshold: 40, category: catPrep._id, storageAreas: ['Front Counter Bar'], lastCost: 48, wacCost: 48, createdBy: adminUser._id,
      recipe: [{ inventoryItemId: raw['Espresso Beans']._id, quantity: 15 }]
    });
    raw['Espresso Shot'] = espShot;

    // Vanilla Sweet Cream
    const sweetCream = await Inventory.create({
      tenantId, storeId: store._id, itemName: 'Vanilla Sweet Cream', unit: 'L', purchaseUnit: 'Jug', storageUnit: 'L', recipeUnit: 'ml',
      purchaseToStorageMultiplier: 1, storageToRecipeMultiplier: 1000, itemType: 'prep', quantity: store.isCentralKitchen ? 100 : 30,
      minThreshold: 5, category: catPrep._id, storageAreas: ['Walk-in Freezer'], lastCost: 540, wacCost: 540, createdBy: adminUser._id,
      recipe: [
        { inventoryItemId: raw['Whole Milk']._id, quantity: 800 },
        { inventoryItemId: raw['Vanilla Syrup']._id, quantity: 100 }
      ]
    });
    raw['Vanilla Sweet Cream'] = sweetCream;

    // Beef Patty (Prep)
    const beefPatty = await Inventory.create({
      tenantId, storeId: store._id, itemName: 'Beef Patty (Prep)', unit: 'pcs', purchaseUnit: 'Tray', storageUnit: 'pcs', recipeUnit: 'pcs',
      purchaseToStorageMultiplier: 1, storageToRecipeMultiplier: 1, itemType: 'prep', quantity: store.isCentralKitchen ? 600 : 120,
      minThreshold: 30, category: catPrep._id, storageAreas: ['Walk-in Freezer'], lastCost: 360, wacCost: 360, createdBy: adminUser._id,
      recipe: [{ inventoryItemId: raw['Ground Beef']._id, quantity: 150 }]
    });
    raw['Beef Patty (Prep)'] = beefPatty;

    // Prep Chicken Portion
    const chickPortion = await Inventory.create({
      tenantId, storeId: store._id, itemName: 'Prep Chicken Portion', unit: 'pcs', purchaseUnit: 'Box', storageUnit: 'pcs', recipeUnit: 'pcs',
      purchaseToStorageMultiplier: 1, storageToRecipeMultiplier: 1, itemType: 'prep', quantity: store.isCentralKitchen ? 400 : 80,
      minThreshold: 20, category: catPrep._id, storageAreas: ['Walk-in Freezer'], lastCost: 320, wacCost: 320, createdBy: adminUser._id,
      recipe: [{ inventoryItemId: raw['Chicken Breast']._id, quantity: 200 }]
    });
    raw['Prep Chicken Portion'] = chickPortion;

    // Garlic Aioli Prep
    const garlicAioli = await Inventory.create({
      tenantId, storeId: store._id, itemName: 'Garlic Aioli Prep', unit: 'L', purchaseUnit: 'Jug', storageUnit: 'L', recipeUnit: 'ml',
      purchaseToStorageMultiplier: 1, storageToRecipeMultiplier: 1000, itemType: 'prep', quantity: store.isCentralKitchen ? 40 : 10,
      minThreshold: 2, category: catPrep._id, storageAreas: ['Walk-in Freezer'], lastCost: 380, wacCost: 380, createdBy: adminUser._id,
      recipe: [{ inventoryItemId: raw['Cooking Oil']._id, quantity: 500 }]
    });
    raw['Garlic Aioli Prep'] = garlicAioli;
  }

  // 11. MODIFIER GROUPS
  console.log('Seeding modifier groups...');
  const modToppings = await ModifierGroup.create({
    tenantId,
    name: 'Burger Add-ons',
    description: 'Customize burger toppings',
    minSelections: 0,
    maxSelections: 4,
    modifiers: [
      { name: 'Extra Cheddar Cheese', price: 150, available: true },
      { name: 'Crispy Onion Strings', price: 100, available: true }
    ]
  });
  const cheeseModifierId = modToppings.modifiers.find(m => m.name === 'Extra Cheddar Cheese')._id;

  const modCoffee = await ModifierGroup.create({
    tenantId,
    name: 'Espresso Customizer',
    description: 'Milk preferences and shots',
    minSelections: 0,
    maxSelections: 2,
    modifiers: [
      { name: 'Extra Espresso Shot', price: 100, available: true },
      { name: 'Oat Milk Override', price: 180, available: true }
    ]
  });
  const oatMilkModifierId = modCoffee.modifiers.find(m => m.name === 'Oat Milk Override')._id;
  const extraShotModifierId = modCoffee.modifiers.find(m => m.name === 'Extra Espresso Shot')._id;

  // 12. CREATE 16 COMPREHENSIVE MENU ITEMS (Tenant-wide, storeId: null)
  console.log('Creating 16 unique Menu Items...');
  
  // (A) Single Variant Items
  const itemBurgerDouble = await MenuItem.create({ tenantId, name: 'Double Cheddar Burger', category: 'Mains', price: 1850, description: 'Double patties, melted cheddar, brioche bun.', available: true, modifierGroups: [{ modifierGroupId: modToppings._id }] });
  const itemBurgerChick = await MenuItem.create({ tenantId, name: 'Classic Chicken Burger', category: 'Mains', price: 1450, description: 'Grilled chicken breast with garlic aioli prep.', available: true, modifierGroups: [{ modifierGroupId: modToppings._id }] });
  const itemBurgerVeg = await MenuItem.create({ tenantId, name: 'Crunchy Veggie Burger', category: 'Mains', price: 1100, description: 'Crispy veggie patty with lettuce, tomatoes.', available: true });
  const itemLatte = await MenuItem.create({ tenantId, name: 'Vanilla Latte', category: 'Beverages', price: 850, description: 'Creamy double-shot latte with vanilla.', available: true, modifierGroups: [{ modifierGroupId: modCoffee._id }] });
  const itemMacchiato = await MenuItem.create({ tenantId, name: 'Caramel Macchiato', category: 'Beverages', price: 900, description: 'Rich espresso, steamed milk, caramel drizzle.', available: true, modifierGroups: [{ modifierGroupId: modCoffee._id }] });
  const itemHotChoc = await MenuItem.create({ tenantId, name: 'Hot Chocolate', category: 'Beverages', price: 750, description: 'Steamed milk with rich chocolate powder.', available: true });
  const itemAmericano = await MenuItem.create({ tenantId, name: 'Iced Americano', category: 'Beverages', price: 600, description: 'Espresso shots over cold water and ice.', available: true });
  const itemSalad = await MenuItem.create({ tenantId, name: 'Fresh Garden Salad', category: 'Sides', price: 650, description: 'Organic lettuce, cherry tomatoes, cucumbers.', available: true });
  const itemOnions = await MenuItem.create({ tenantId, name: 'Crispy Onion Rings', category: 'Sides', price: 500, description: 'Deep fried batter-coated fresh onion rings.', available: true });

  // (B) Multi-Variant Items
  const itemPizzaMargherita = await MenuItem.create({
    tenantId,
    name: 'Gourmet Margherita Pizza',
    category: 'Mains',
    price: 1200,
    description: 'Mozzarella cheese, fresh tomatoes on hand-stretched sourdough crust.',
    available: true,
    hasVariants: true,
    variantOptions: [{ name: 'Size', values: ['Personal 8"', 'Medium 12"', 'Large 14"'] }],
    variants: [
      { name: 'Personal 8"', price: 1200, available: true, attributes: [{ name: 'Size', value: 'Personal 8"' }] },
      { name: 'Medium 12"', price: 1950, available: true, attributes: [{ name: 'Size', value: 'Medium 12"' }] },
      { name: 'Large 14"', price: 2600, available: true, attributes: [{ name: 'Size', value: 'Large 14"' }] }
    ]
  });

  const itemPizzaBBQ = await MenuItem.create({
    tenantId,
    name: 'Barbecue Chicken Pizza',
    category: 'Mains',
    price: 1400,
    description: 'Smoked chicken cubes, onions, sweet honey BBQ sauce.',
    available: true,
    hasVariants: true,
    variantOptions: [{ name: 'Size', values: ['Personal 8"', 'Medium 12"', 'Large 14"'] }],
    variants: [
      { name: 'Personal 8"', price: 1400, available: true, attributes: [{ name: 'Size', value: 'Personal 8"' }] },
      { name: 'Medium 12"', price: 2200, available: true, attributes: [{ name: 'Size', value: 'Medium 12"' }] },
      { name: 'Large 14"', price: 2950, available: true, attributes: [{ name: 'Size', value: 'Large 14"' }] }
    ]
  });

  const itemTea = await MenuItem.create({
    tenantId,
    name: 'Ceylon Black Tea',
    category: 'Beverages',
    price: 400,
    description: 'Premium organic black tea leaves from Sri Lankan estates.',
    available: true,
    hasVariants: true,
    variantOptions: [{ name: 'Style', values: ['Hot Pot', 'Iced Cup'] }],
    variants: [
      { name: 'Hot Pot', price: 400, available: true, attributes: [{ name: 'Style', value: 'Hot Pot' }] },
      { name: 'Iced Cup', price: 480, available: true, attributes: [{ name: 'Style', value: 'Iced Cup' }] }
    ]
  });

  const itemFries = await MenuItem.create({
    tenantId,
    name: 'Loaded French Fries',
    category: 'Sides',
    price: 600,
    description: 'Golden fries seasoned with sea salt and customized spices.',
    available: true,
    hasVariants: true,
    variantOptions: [{ name: 'Portion', values: ['Regular', 'Large'] }],
    variants: [
      { name: 'Regular', price: 600, available: true, attributes: [{ name: 'Portion', value: 'Regular' }] },
      { name: 'Large', price: 900, available: true, attributes: [{ name: 'Portion', value: 'Large' }] }
    ]
  });

  // (C) Combos
  const itemComboBurgerFries = await MenuItem.create({
    tenantId,
    name: 'Burger & Fries Combo',
    category: 'Combos',
    price: 2200, // Discounted combo price
    description: 'Double Cheddar Burger bundled with loaded french fries regular.',
    available: true,
    isCombo: true,
    comboItems: [
      { menuItem: itemBurgerDouble._id, name: 'Double Cheddar Burger', qty: 1 },
      { menuItem: itemFries._id, name: 'Loaded French Fries (Regular)', qty: 1 }
    ]
  });

  const itemComboPizzaCoffee = await MenuItem.create({
    tenantId,
    name: 'Pizza & Coffee Feast',
    category: 'Combos',
    price: 2600,
    description: 'Gourmet Margherita Pizza Medium coupled with Vanilla Latte.',
    available: true,
    isCombo: true,
    comboItems: [
      { menuItem: itemPizzaMargherita._id, name: 'Gourmet Margherita Pizza (Medium)', qty: 1 },
      { menuItem: itemLatte._id, name: 'Vanilla Latte', qty: 1 }
    ]
  });

  const itemComboCoffeeBreak = await MenuItem.create({
    tenantId,
    name: 'Quick Coffee Break',
    category: 'Combos',
    price: 1000,
    description: 'Hot Chocolate bundled with Ceylon Black Tea Hot Pot.',
    available: true,
    isCombo: true,
    comboItems: [
      { menuItem: itemHotChoc._id, name: 'Hot Chocolate', qty: 1 },
      { menuItem: itemTea._id, name: 'Ceylon Black Tea (Hot Pot)', qty: 1 }
    ]
  });

  // 13. INGREDIENT RECIPE LINKS
  console.log('Mapping ingredient links for base items, variants, and modifiers...');
  const refStoreId = fortStore._id.toString();
  const branchInv = inventoryItemsByStore[refStoreId];

  const createLink = async (menuItemDoc, invItemName, qty, unitStr, modifierIdVal = null, variantIdVal = null) => {
    await IngredientLink.create({
      tenantId,
      menuItemId: menuItemDoc._id,
      inventoryItemId: branchInv[invItemName]._id,
      quantity: qty,
      unit: unitStr,
      modifierId: modifierIdVal,
      variantId: variantIdVal,
      createdBy: adminUser._id
    });
  };

  // Double Cheddar Burger
  await createLink(itemBurgerDouble, 'Beef Patty (Prep)', 2, 'pcs');
  await createLink(itemBurgerDouble, 'Brioche Buns', 1, 'pcs');
  await createLink(itemBurgerDouble, 'Cheddar Cheese', 50, 'g');
  await createLink(itemBurgerDouble, 'Lettuce', 10, 'g');
  await createLink(itemBurgerDouble, 'Tomatoes', 15, 'g');
  // Modifier links for toppings
  await createLink(itemBurgerDouble, 'Cheddar Cheese', 25, 'g', cheeseModifierId);

  // Classic Chicken Burger
  await createLink(itemBurgerChick, 'Prep Chicken Portion', 1, 'pcs');
  await createLink(itemBurgerChick, 'Brioche Buns', 1, 'pcs');
  await createLink(itemBurgerChick, 'Garlic Aioli Prep', 15, 'ml');
  await createLink(itemBurgerChick, 'Lettuce', 10, 'g');

  // Veggie Burger
  await createLink(itemBurgerVeg, 'Brioche Buns', 1, 'pcs');
  await createLink(itemBurgerVeg, 'Lettuce', 15, 'g');
  await createLink(itemBurgerVeg, 'Tomatoes', 20, 'g');

  // Vanilla Latte
  await createLink(itemLatte, 'Espresso Shot', 1, 'Shot');
  await createLink(itemLatte, 'Whole Milk', 250, 'ml');
  await createLink(itemLatte, 'Vanilla Syrup', 30, 'ml');
  await createLink(itemLatte, 'Paper Cups', 1, 'pcs');
  // Modifiers
  await createLink(itemLatte, 'Espresso Shot', 1, 'Shot', extraShotModifierId);

  // Macchiato
  await createLink(itemMacchiato, 'Espresso Shot', 2, 'Shot');
  await createLink(itemMacchiato, 'Whole Milk', 220, 'ml');
  await createLink(itemMacchiato, 'Vanilla Syrup', 15, 'ml');

  // Hot Chocolate
  await createLink(itemHotChoc, 'Whole Milk', 250, 'ml');
  await createLink(itemHotChoc, 'Chocolate Powder', 30, 'g');

  // Americano
  await createLink(itemAmericano, 'Espresso Shot', 2, 'Shot');
  await createLink(itemAmericano, 'Paper Cups', 1, 'pcs');

  // Sides & Salad
  await createLink(itemSalad, 'Lettuce', 80, 'g');
  await createLink(itemSalad, 'Tomatoes', 40, 'g');

  // Pizza Margherita variants
  for (const v of itemPizzaMargherita.variants) {
    const mult = v.name.includes('Personal') ? 1 : (v.name.includes('Medium') ? 2 : 3);
    await createLink(itemPizzaMargherita, 'Cheddar Cheese', 100 * mult, 'g', null, v._id);
    await createLink(itemPizzaMargherita, 'Tomatoes', 50 * mult, 'g', null, v._id);
  }

  // BBQ Pizza variants
  for (const v of itemPizzaBBQ.variants) {
    const mult = v.name.includes('Personal') ? 1 : (v.name.includes('Medium') ? 2 : 3);
    await createLink(itemPizzaBBQ, 'Prep Chicken Portion', 0.5 * mult, 'pcs', null, v._id);
    await createLink(itemPizzaBBQ, 'Cheddar Cheese', 80 * mult, 'g', null, v._id);
  }

  // Fries variants
  for (const v of itemFries.variants) {
    const qty = v.name === 'Regular' ? 200 : 350;
    await createLink(itemFries, 'French Fries', qty, 'g', null, v._id);
    await createLink(itemFries, 'Cooking Oil', 30, 'ml', null, v._id);
  }

  // 14. INVENTORY COUNT SHEET
  console.log('Registering count sheet template...');
  const countSheet = await CountSheet.create({
    tenantId,
    storeId: fortStore._id,
    name: 'EOD General Sheet',
    storageAreas: ['Walk-in Freezer', 'Dry Pantry', 'Front Counter Bar'],
    items: [
      { inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Espresso Beans']._id, displayOrder: 0 },
      { inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Whole Milk']._id, displayOrder: 1 },
      { inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Beef Patty (Prep)']._id, displayOrder: 2 },
      { inventoryItemId: inventoryItemsByStore[fortStore._id.toString()]['Brioche Buns']._id, displayOrder: 3 }
    ]
  });

  // 15. PO & GRN REPLENISHMENT HISTORY (Week 1 & Week 2)
  console.log('Seeding PO and GRN historical transactions...');
  let poCounter = 2000;
  let grnCounter = 3000;

  for (const store of retailStores) {
    const storeIdStr = store._id.toString();
    const beans = inventoryItemsByStore[storeIdStr]['Espresso Beans'];
    const milk = inventoryItemsByStore[storeIdStr]['Whole Milk'];

    poCounter++;
    grnCounter++;

    // Create a Purchase Order
    const po = await PurchaseOrder.create({
      tenantId,
      storeId: store._id,
      orderNumber: `PO-${poCounter}`,
      supplierId: supplierCeylonBev._id,
      status: 'completed',
      totalAmount: 16000, // 5 bags * 3200
      expectedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      createdBy: purchaserUser._id,
      sentAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      sentBy: purchaserUser._id,
      items: [
        {
          inventoryItemId: beans._id,
          itemName: 'Espresso Beans',
          unit: 'kg',
          orderedQty: 5,
          receivedQty: 5,
          unitPrice: 3200
        }
      ]
    });

    // Create Goods Receipt (GRN) for this PO
    const grn = await GoodsReceipt.create({
      tenantId,
      storeId: store._id,
      receiptNumber: `GRN-${grnCounter}`,
      type: 'receipt',
      purchaseOrderId: po._id,
      supplierId: supplierCeylonBev._id,
      status: 'confirmed',
      totalAmount: 16000,
      receiptDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      createdBy: clerkUser._id,
      confirmedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      confirmedBy: managerUser._id,
      items: [
        {
          inventoryItemId: beans._id,
          itemName: 'Espresso Beans',
          unit: 'kg',
          orderedQty: 5,
          receivedQty: 5,
          acceptedQty: 5,
          unitPrice: 3200
        }
      ]
    });

    // Add to stock and log movement
    const oldQty = beans.quantity;
    beans.quantity = oldQty + 5;
    await beans.save();

    await StockMovement.create({
      tenantId,
      storeId: store._id,
      inventoryItemId: beans._id,
      goodsReceiptId: grn._id,
      purchaseOrderId: po._id,
      type: 'grn',
      quantity: 5,
      previousQty: oldQty,
      newQty: beans.quantity,
      reason: `Received from PO-${po.orderNumber} / GRN-${grn.receiptNumber}`,
      createdBy: clerkUser._id,
      createdAt: grn.receiptDate
    });
  }

  // 16. GENERATE 14 DAYS OF RETAIL TRANSACTIONS IN MULTIPLE STATUSES
  console.log('Generating 14 days of sales history in different statuses (dine-in with tables, customer attachments)...');
  const startDay = new Date();
  startDay.setDate(startDay.getDate() - 14);

  let orderNumber = 5000;
  let transferCounter = 800;

  for (let d = 0; d <= 14; d++) {
    const currentDay = new Date(startDay);
    currentDay.setDate(startDay.getDate() + d);

    // Commissary stock transfers from Central Kitchen
    if (d % 4 === 0) {
      for (const store of retailStores) {
        transferCounter++;
        const transferItems = [
          { inventoryItemId: inventoryItemsByStore[ckStore._id.toString()]['Beef Patty (Prep)']._id, qtySent: 50, qtyReceived: 50, unit: 'pcs' },
          { inventoryItemId: inventoryItemsByStore[ckStore._id.toString()]['Prep Chicken Portion']._id, qtySent: 30, qtyReceived: 30, unit: 'pcs' }
        ];

        await StockTransfer.create({
          tenantId, sourceStoreId: ckStore._id, targetStoreId: store._id, transferNumber: `TR-${transferCounter}`, status: 'received',
          items: transferItems, shippedAt: currentDay, receivedAt: currentDay, notes: 'Replenish patties and chicken preps',
          createdBy: operatorUser._id, receivedBy: clerkUser._id
        });

        // Update stock levels
        for (const item of transferItems) {
          const name = item.inventoryItemId.toString() === inventoryItemsByStore[ckStore._id.toString()]['Beef Patty (Prep)']._id.toString() ? 'Beef Patty (Prep)' : 'Prep Chicken Portion';
          
          const ckInv = inventoryItemsByStore[ckStore._id.toString()][name];
          const oldCk = ckInv.quantity;
          ckInv.quantity = Math.max(0, oldCk - item.qtySent);
          await ckInv.save();
          await StockMovement.create({ tenantId, storeId: ckStore._id, inventoryItemId: ckInv._id, type: 'adjustment', quantity: -item.qtySent, previousQty: oldCk, newQty: ckInv.quantity, reason: `TR-${transferCounter} Dispatch`, createdBy: operatorUser._id, createdAt: currentDay });

          const brInv = inventoryItemsByStore[store._id.toString()][name];
          const oldBr = brInv.quantity;
          brInv.quantity = oldBr + item.qtyReceived;
          await brInv.save();
          await StockMovement.create({ tenantId, storeId: store._id, inventoryItemId: brInv._id, type: 'adjustment', quantity: item.qtyReceived, previousQty: oldBr, newQty: brInv.quantity, reason: `TR-${transferCounter} Receipt`, createdBy: clerkUser._id, createdAt: currentDay });
        }
      }
    }

    // Daily Sales Orders
    for (const store of retailStores) {
      const storeIdStr = store._id.toString();
      const tables = tablesByStore[storeIdStr];
      const dailyOrdersCount = Math.floor(Math.random() * 6) + 8; // 8 to 13 orders per day

      for (let o = 0; o < dailyOrdersCount; o++) {
        orderNumber++;
        const hour = Math.floor(Math.random() * 12) + 9;
        const orderTime = new Date(currentDay);
        orderTime.setHours(hour, Math.floor(Math.random() * 60));

        // Determine status (completed is majority, but seed other statuses on the final day)
        let status = 'completed';
        if (d === 14) { // Final day (today) has active orders
          const statusRand = Math.random();
          if (statusRand < 0.1) status = 'pending';
          else if (statusRand < 0.2) status = 'preparing';
          else if (statusRand < 0.3) status = 'ready';
          else if (statusRand < 0.4) status = 'delivered';
          else if (statusRand < 0.5) status = 'cancelled';
        }

        const table = tables[o % tables.length];
        const customer = customers[o % customers.length];

        // Items logic
        const burgerQty = Math.floor(Math.random() * 2) + 1;
        const latteQty = Math.floor(Math.random() * 2) + 1;
        const extraCheese = Math.random() > 0.5;

        const orderItems = [
          {
            menuItem: itemBurgerDouble._id, name: itemBurgerDouble.name, category: itemBurgerDouble.category, qty: burgerQty, price: itemBurgerDouble.price,
            modifiers: extraCheese ? [{ modifierGroupId: modToppings._id, modifierId: cheeseModifierId, name: 'Extra Cheddar Cheese', price: 150, qty: burgerQty }] : []
          },
          {
            menuItem: itemLatte._id, name: itemLatte.name, category: itemLatte.category, qty: latteQty, price: itemLatte.price
          }
        ];

        const subtotal = (burgerQty * 1850) + (latteQty * 850) + (extraCheese ? burgerQty * 150 : 0);
        const taxAmount = Math.round(subtotal * 0.08);
        const totalAmount = subtotal + taxAmount;

        const order = await Order.create({
          tenantId, storeId: store._id, orderNumber, orderType: 'dine-in', tableNumber: table.label, tableId: table._id,
          items: orderItems, status, subtotal, taxRate: 8, taxAmount, totalAmount, paymentType: 'cash',
          paymentAmount: status === 'cancelled' ? 0 : totalAmount, paymentCollected: status === 'completed',
          customerId: customer._id, createdAt: orderTime, updatedAt: orderTime
        });

        // Earn loyalty points if completed
        if (status === 'completed') {
          const pointsEarned = Math.floor(totalAmount / 100);
          const beforePoints = customer.lifetimePoints;
          customer.lifetimePoints = beforePoints + pointsEarned;
          customer.pointsHistory.push({
            type: 'earn',
            points: pointsEarned,
            beforePoints,
            afterPoints: customer.lifetimePoints,
            note: `Earned from Order #${orderNumber}`,
            orderId: order._id,
            orderNumber: String(orderNumber)
          });
          await customer.save();
        }

        // Inventory Stock Depletion & COGS
        if (status !== 'cancelled') {
          let calculatedCogs = 0;

          // Double Burger ingredients
          const patty = inventoryItemsByStore[storeIdStr]['Beef Patty (Prep)'];
          const buns = inventoryItemsByStore[storeIdStr]['Brioche Buns'];
          const cheese = inventoryItemsByStore[storeIdStr]['Cheddar Cheese'];

          // Patty (2 per burger)
          const pattyDeduct = burgerQty * 2;
          calculatedCogs += pattyDeduct * patty.wacCost;
          const oldPatty = patty.quantity;
          patty.quantity = Math.max(0, oldPatty - pattyDeduct);
          await patty.save();
          await StockMovement.create({ tenantId, storeId: store._id, inventoryItemId: patty._id, type: 'adjustment', quantity: -pattyDeduct, previousQty: oldPatty, newQty: patty.quantity, reason: 'Sales order depletion', createdBy: cashierUser._id, createdAt: orderTime });

          // Bun (1 per burger)
          const bunDeduct = burgerQty;
          calculatedCogs += bunDeduct * buns.wacCost;
          const oldBuns = buns.quantity;
          buns.quantity = Math.max(0, oldBuns - bunDeduct);
          await buns.save();
          await StockMovement.create({ tenantId, storeId: store._id, inventoryItemId: buns._id, type: 'adjustment', quantity: -bunDeduct, previousQty: oldBuns, newQty: buns.quantity, reason: 'Sales order depletion', createdBy: cashierUser._id, createdAt: orderTime });

          // Cheese (50g + 25g extra cheese)
          const cheeseDeductG = (burgerQty * 50) + (extraCheese ? burgerQty * 25 : 0);
          const cheeseDeductKg = cheeseDeductG / 1000;
          calculatedCogs += cheeseDeductKg * cheese.wacCost;
          const oldCheese = cheese.quantity;
          cheese.quantity = Math.max(0, oldCheese - cheeseDeductKg);
          await cheese.save();
          await StockMovement.create({ tenantId, storeId: store._id, inventoryItemId: cheese._id, type: 'adjustment', quantity: -cheeseDeductKg, previousQty: oldCheese, newQty: cheese.quantity, reason: 'Sales order depletion', createdBy: cashierUser._id, createdAt: orderTime });

          // Coffee ingredients
          const shot = inventoryItemsByStore[storeIdStr]['Espresso Shot'];
          const milk = inventoryItemsByStore[storeIdStr]['Whole Milk'];
          const cups = inventoryItemsByStore[storeIdStr]['Paper Cups'];

          // Espresso (1 shot)
          const shotDeduct = latteQty;
          calculatedCogs += shotDeduct * shot.wacCost;
          const oldShot = shot.quantity;
          shot.quantity = Math.max(0, oldShot - shotDeduct);
          await shot.save();
          await StockMovement.create({ tenantId, storeId: store._id, inventoryItemId: shot._id, type: 'adjustment', quantity: -shotDeduct, previousQty: oldShot, newQty: shot.quantity, reason: 'Sales order depletion', createdBy: cashierUser._id, createdAt: orderTime });

          // Milk (250ml)
          const milkDeductL = (latteQty * 250) / 1000;
          calculatedCogs += milkDeductL * milk.wacCost;
          const oldMilk = milk.quantity;
          milk.quantity = Math.max(0, oldMilk - milkDeductL);
          await milk.save();
          await StockMovement.create({ tenantId, storeId: store._id, inventoryItemId: milk._id, type: 'adjustment', quantity: -milkDeductL, previousQty: oldMilk, newQty: milk.quantity, reason: 'Sales order depletion', createdBy: cashierUser._id, createdAt: orderTime });

          // Cup (1)
          const cupDeduct = latteQty;
          calculatedCogs += cupDeduct * cups.wacCost;
          const oldCups = cups.quantity;
          cups.quantity = Math.max(0, oldCups - cupDeduct);
          await cups.save();
          await StockMovement.create({ tenantId, storeId: store._id, inventoryItemId: cups._id, type: 'adjustment', quantity: -cupDeduct, previousQty: oldCups, newQty: cups.quantity, reason: 'Sales order depletion', createdBy: cashierUser._id, createdAt: orderTime });

          // Record Journal log for finished sales
          if (status === 'completed') {
            await JournalEntry.create({
              tenantId, storeId: store._id, date: orderTime, reference: `Order #${orderNumber}`, referenceModel: 'Order',
              description: `Sales revenue and COGS for Order #${orderNumber}`, createdBy: cashierUser._id,
              lines: [
                { accountId: accCash._id, debit: totalAmount, credit: 0, description: 'Cash collected' },
                { accountId: accRevenue._id, debit: 0, credit: totalAmount, description: 'Sales Revenue' },
                { accountId: accCogs._id, debit: Math.round(calculatedCogs), credit: 0, description: 'Cost of Goods Sold' },
                { accountId: accInventory._id, debit: 0, credit: Math.round(calculatedCogs), description: 'Inventory stock depletion' }
              ]
            });
          }
        }
      }
    }

    // Daily spillage/wastage logs (every 4 days)
    if (d % 4 === 2) {
      for (const store of retailStores) {
        const storeIdStr = store._id.toString();
        const milk = inventoryItemsByStore[storeIdStr]['Whole Milk'];
        const oldQty = milk.quantity;

        milk.quantity = Math.max(0, oldQty - 2);
        await milk.save();

        await WastageReport.create({
          tenantId, storeId: store._id, date: currentDay, type: 'spill_expiry_damage', notes: 'Milk damage',
          createdBy: clerkUser._id, items: [{ itemType: 'inventory', inventoryItemId: milk._id, quantity: 2, reason: 'spillage' }]
        });

        await StockMovement.create({
          tenantId, storeId: store._id, inventoryItemId: milk._id, type: 'waste', quantity: -2, previousQty: oldQty,
          newQty: milk.quantity, reason: 'Spilled Whole Milk', createdBy: clerkUser._id, createdAt: currentDay
        });

        const wasteCost = Math.round(2 * milk.wacCost);
        await JournalEntry.create({
          tenantId, storeId: store._id, date: currentDay, reference: 'EOD Wastage', referenceModel: 'Manual',
          description: 'Inventory spillage write-off', createdBy: clerkUser._id,
          lines: [
            { accountId: accWastage._id, debit: wasteCost, credit: 0, description: 'Wastage expense' },
            { accountId: accInventory._id, debit: 0, credit: wasteCost, description: 'Inventory asset depletion' }
          ]
        });
      }
    }

    // Weekly Sunday Stocktake (d = 7 or 14)
    if (d === 7 || d === 14) {
      for (const store of retailStores) {
        const storeIdStr = store._id.toString();
        const milk = inventoryItemsByStore[storeIdStr]['Whole Milk'];
        const buns = inventoryItemsByStore[storeIdStr]['Brioche Buns'];

        const session = await InventoryCountSession.create({
          tenantId, storeId: store._id, countSheetId: countSheet._id, status: 'closed', userId: clerkUser._id,
          notes: `EOD Stocktake Week ${d === 7 ? '1' : '2'}`, endedAt: currentDay,
          items: [
            { inventoryItemId: milk._id, theoreticalQty: milk.quantity, countedQty: Math.max(0, Math.round(milk.quantity - 1)), costPrice: milk.wacCost },
            { inventoryItemId: buns._id, theoreticalQty: buns.quantity, countedQty: buns.quantity, costPrice: buns.wacCost }
          ]
        });

        for (const sessionItem of session.items) {
          const variance = sessionItem.countedQty - sessionItem.theoreticalQty;
          if (variance !== 0) {
            const invDoc = inventoryItemsByStore[storeIdStr][sessionItem.inventoryItemId.toString() === milk._id.toString() ? 'Whole Milk' : 'Brioche Buns'];
            const oldQty = invDoc.quantity;
            invDoc.quantity = sessionItem.countedQty;
            await invDoc.save();

            await StockMovement.create({
              tenantId, storeId: store._id, inventoryItemId: invDoc._id, sessionId: session._id, type: 'adjustment',
              quantity: variance, previousQty: oldQty, newQty: sessionItem.countedQty, reason: 'Stocktake variance adjustment',
              createdBy: clerkUser._id, createdAt: currentDay
            });
          }
        }
      }
    }
  }

  console.log('\n=========================================');
  console.log('ULTIMATE DEMO SEEDING COMPLETED SUCCESSFULLY!');
  console.log('=========================================');
  console.log(`Tenant Slug:      demo-merchant`);
  console.log(`Plan Details:     All Addons Enabled`);
  console.log(`Stores Created:   4 (${stores.map(s => `${s.name} [${s.code}]`).join(', ')})`);
  console.log(`Staff Users:      8 roles (admin@ / manager@ / cashier@ / kitchen@ / steward@ / clerk@ / operator@ / purchaser@flavormatrix.com)`);
  console.log(`Dining Tables:    12 tables per retail store mapped to default floorplan layouts`);
  console.log(`Customers:        10 loyalty customer profiles`);
  console.log(`Suppliers:        Ceylon Beverage, Lanka Dairies, Cargills, Keells, PrintPack`);
  console.log(`Inventory Items:  15+ items (raw Espresso, Milk, Buns, Cheese, Beef, Chicken, Packaging, etc. + preps)`);
  console.log(`Menu Items:       16 unique items (Burgers, Pizza, Caramel Macchiatos, Combos, Topping customizers)`);
  console.log(`PO & GRNs:        Seeded confirmed historical Purchase Orders and Goods Received Notes`);
  console.log(`Active Orders:    Transactions generated in completed, preparing, pending, ready, and cancelled statuses`);
  console.log(`Journal Entries:  Integrated double-entry accounts journal balance logging`);
  console.log('=========================================\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('Error during demo seeding:', err);
  process.exit(1);
});
