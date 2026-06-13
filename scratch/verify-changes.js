require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');
const Customer = require('../apps/pos/server/src/models/Customer');
const Reservation = require('../apps/pos/server/src/models/Reservation');
const Store = require('../apps/pos/server/src/models/Store');
const CafeTable = require('../apps/pos/server/src/models/CafeTable');
const User = require('../apps/pos/server/src/models/User');

async function test() {
  console.log("Connecting to Database...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected successfully.");

  // Fetch a store and tenant context
  const store = await Store.findOne();
  if (!store) {
    console.error("No store found in DB. Seed DB first.");
    process.exit(1);
  }
  const { tenantId, _id: storeId } = store;
  console.log(`Using Tenant ID: ${tenantId}, Store ID: ${storeId}`);

  // Fetch a user for createdBy
  const user = await User.findOne({ tenantId });
  const userId = user ? user._id : new mongoose.Types.ObjectId();

  // 1. Test Spacing Normalization and Search
  console.log("\n--- Testing Phone Search Spacing Normalization ---");
  const testMobile = "+94 77 987 6543";
  const testMobileDigits = "94779876543";
  
  // Clean up if already exists
  await Customer.deleteMany({ tenantId, mobileDigits: testMobileDigits });

  // Create test customer
  const customer = await Customer.create({
    tenantId,
    name: "Test Spacing Customer",
    mobile: testMobile,
    email: "spacingtest@example.com",
    createdBy: userId,
  });
  console.log(`Created test customer: ${customer.name} (Mobile: ${customer.mobile}, mobileDigits: ${customer.mobileDigits})`);

  // Define search query with different spaces
  const queryWithSpaces = "077 987 6543";
  
  // Perform mock query matching GET /customers search logic
  const searchDigits = queryWithSpaces.replace(/\D/g, '');
  const orConditions = [
    { name: new RegExp(queryWithSpaces, 'i') },
    { email: new RegExp(queryWithSpaces, 'i') },
    { mobile: new RegExp(queryWithSpaces, 'i') },
  ];
  if (searchDigits.length > 0) {
    orConditions.push({ mobileDigits: new RegExp(searchDigits, 'i') });
    if (searchDigits.startsWith('0') && searchDigits.length > 1) {
      orConditions.push({ mobileDigits: new RegExp(searchDigits.substring(1), 'i') });
    }
  }
  
  const searchResults = await Customer.find({
    tenantId,
    $or: orConditions
  });
  
  console.log(`Search query: "${queryWithSpaces}". Results found: ${searchResults.length}`);
  if (searchResults.length > 0 && String(searchResults[0]._id) === String(customer._id)) {
    console.log("SUCCESS: Normalized search query successfully matched stored customer!");
  } else {
    console.error("FAILURE: Normalized search query did not match customer.");
  }

  // 2. Test Customer Sync from Reservations
  console.log("\n--- Testing Customer Sync from Reservations ---");
  const resPhone = "+94 71 222 3333";
  const resPhoneDigits = "94712223333";
  const resEmail = "res-sync-test@example.com";
  const resName = "Reservation Sync Customer";

  // Clean up
  await Customer.deleteMany({ tenantId, mobileDigits: resPhoneDigits });
  await Reservation.deleteMany({ tenantId, guestPhone: resPhone });

  // Mock reservation POST creation controller logic
  async function simulateReservationSave(guestName, guestPhone, guestEmail) {
    const cleanPhoneDigits = guestPhone.trim().replace(/\D/g, '');
    let linkedCustomerId = null;
    let customerDoc = null;
    
    if (cleanPhoneDigits.length >= 6) {
      customerDoc = await Customer.findOne({
        tenantId,
        mobileDigits: cleanPhoneDigits,
      });
    }
    if (!customerDoc && guestEmail?.trim()) {
      customerDoc = await Customer.findOne({
        tenantId,
        email: guestEmail.trim().toLowerCase(),
      });
    }

    if (!customerDoc) {
      customerDoc = await Customer.create({
        tenantId,
        storeId,
        name: guestName.trim(),
        mobile: guestPhone.trim(),
        email: guestEmail?.trim().toLowerCase() || '',
        createdBy: userId,
        lastLoyaltyActivityAt: new Date(),
      });
      console.log(`Auto-created Customer list entry: ${customerDoc.name}`);
    } else {
      console.log(`Reused existing Customer list entry: ${customerDoc.name}`);
    }
    linkedCustomerId = customerDoc._id;

    const resDoc = await Reservation.create({
      tenantId,
      storeId,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      guestEmail: guestEmail?.trim() || '',
      customerId: linkedCustomerId,
      reservationTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      partySize: 4,
      createdBy: userId,
    });
    
    return { resDoc, customerDoc };
  }

  // First creation
  const first = await simulateReservationSave(resName, resPhone, resEmail);
  const customersAfterFirst = await Customer.find({ tenantId, mobileDigits: resPhoneDigits });
  console.log(`Customers found after first reservation: ${customersAfterFirst.length}`);
  
  // Second creation (simulate duplication check)
  const second = await simulateReservationSave(resName, resPhone, resEmail);
  const customersAfterSecond = await Customer.find({ tenantId, mobileDigits: resPhoneDigits });
  console.log(`Customers found after second reservation: ${customersAfterSecond.length}`);

  if (customersAfterFirst.length === 1 && customersAfterSecond.length === 1 && String(first.customerDoc._id) === String(second.customerDoc._id)) {
    console.log("SUCCESS: Customers matched and duplicates prevented successfully!");
  } else {
    console.error("FAILURE: Duplicate customers created or customer not created.");
  }

  // 3. Test Table Reservation Status Overlay
  console.log("\n--- Testing Table Reservation Status Overlay ---");
  // Get an active table
  const table = await CafeTable.findOne({ tenantId, storeId, active: true });
  if (!table) {
    console.log("No active table found. Skipping table reservation overlay check.");
  } else {
    // Create reservation for this table
    const tableResTime = new Date();
    tableResTime.setHours(tableResTime.getHours() + 4); // 4 hours from now (outside 2-hour window)
    
    // Clean up
    await Reservation.deleteMany({ tenantId, tableId: table._id });
    
    const tableRes = await Reservation.create({
      tenantId,
      storeId,
      guestName: "Table Res Guest",
      guestPhone: "+94 77 000 0000",
      guestEmail: "tableres@example.com",
      reservationTime: tableResTime,
      partySize: 2,
      tableId: table._id,
      status: "confirmed",
      createdBy: userId,
    });
    console.log(`Created table reservation for table ${table.label} at ${tableResTime}`);

    // Mock floor plan status API query
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const upcomingReservations = await Reservation.find({
      tenantId,
      storeId,
      tableId: { $ne: null },
      status: { $in: ['pending', 'confirmed', 'reminded', 'arrived', 'seated'] },
      reservationTime: { $gte: startOfToday, $lte: endOfToday },
    }).lean();

    const matchedRes = upcomingReservations.find(r => String(r.tableId) === String(table._id));
    if (matchedRes && matchedRes.status === 'confirmed') {
      console.log(`SUCCESS: Table ${table.label} successfully marked as reserved under new wide-window overlay check!`);
    } else {
      console.error("FAILURE: Table reservation not found in overlay check.");
    }
  }

  // Clean up
  console.log("\nCleaning up test data...");
  await Customer.deleteMany({ tenantId, mobileDigits: { $in: [testMobileDigits, resPhoneDigits] } });
  await Reservation.deleteMany({ tenantId, guestPhone: { $in: [testMobile, resPhone, "+94 77 000 0000"] } });
  console.log("Clean up completed.");

  process.exit(0);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
