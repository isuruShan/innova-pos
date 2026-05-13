const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');

/** Drop legacy sparse-unique index that treated clientRequestId:null as one key per tenant (E11000 dup). */
async function migrateOrdersClientRequestIdIndex(logger) {
  try {
    const Order = require('../models/Order');
    const indexes = await Order.collection.indexes();
    const legacy = indexes.find((i) => i.name === 'tenantId_1_clientRequestId_1');
    if (legacy && !legacy.partialFilterExpression) {
      await Order.collection.dropIndex('tenantId_1_clientRequestId_1');
      const msg = '[db] Dropped legacy orders index tenantId_1_clientRequestId_1 (partial unique replaces it)';
      if (logger) logger.info(msg);
      else console.log(msg);
    }
    await Order.syncIndexes();
  } catch (e) {
    const msg = `[db] orders index migration: ${e.message}`;
    if (logger) logger.warn(msg);
    else console.warn(msg);
  }
}

const connectDB = async (logger) => {
  try {
    const conn = await mongoose.connect(getMongoConnectionString());
    const msg = `MongoDB connected: ${conn.connection.host}`;
    if (logger) logger.info(msg);
    else console.log(msg);
    await migrateOrdersClientRequestIdIndex(logger);
  } catch (err) {
    const msg = `MongoDB connection error: ${err.message}`;
    if (logger) logger.error(msg);
    else console.error(msg);
    process.exit(1);
  }
};

module.exports = connectDB;
