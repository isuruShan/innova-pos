const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');

async function connectDB(logger) {
  try {
    const conn = await mongoose.connect(getMongoConnectionString());
    const msg = `[qr-order-server] MongoDB connected: ${conn.connection.host}`;
    if (logger) logger.info(msg);
    else console.log(msg);
  } catch (err) {
    const msg = `[qr-order-server] MongoDB connection error: ${err.message}`;
    if (logger) logger.error(msg);
    else console.error(msg);
    process.exit(1);
  }
}

module.exports = connectDB;
