const mongoose = require('mongoose');

const connectDB = async (logger) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error('MongoDB connection error', { error: err.message });
    process.exit(1);
  }
};

module.exports = connectDB;
