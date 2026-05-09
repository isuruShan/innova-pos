const mongoose = require('mongoose');

const connectDB = async (logger) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    const msg = `MongoDB connected: ${conn.connection.host}`;
    if (logger) logger.info(msg);
    else console.log(msg);
  } catch (err) {
    const msg = `MongoDB connection error: ${err.message}`;
    if (logger) logger.error(msg);
    else console.error(msg);
    process.exit(1);
  }
};

module.exports = connectDB;
