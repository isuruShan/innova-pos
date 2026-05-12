const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');

const connectDB = async (logger) => {
  try {
    const conn = await mongoose.connect(getMongoConnectionString());
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error('MongoDB connection error', { error: err.message });
    process.exit(1);
  }
};

module.exports = connectDB;
