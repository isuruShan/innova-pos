require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const Store = require('./apps/pos/server/src/models/Store');
  const User = require('./apps/pos/server/src/models/User');
  
  const user = await User.findOne({ role: 'manager' });
  const store = await Store.findOne({ tenantId: user.tenantId });
  
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: user._id, role: user.role, tenantId: user.tenantId }, process.env.JWT_SECRET);
  
  try {
    const res = await fetch('http://localhost:5000/api/reports/extended/menu-mix?since=2024-01-01T00:00:00&until=2026-12-31T23:59:59', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-store-id': store._id.toString()
      }
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text.slice(0, 100));
  } catch (err) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}
test().catch(console.error);
