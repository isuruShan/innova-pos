const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');
const Order = require('../models/Order');

function getArchiveMongoConnectionString(mainUri) {
  try {
    const parsed = new URL(mainUri);
    const baseName = parsed.pathname.replace(/^\//, '') || 'innovapos';
    parsed.pathname = `/${baseName}_archive`;
    return parsed.toString();
  } catch (e) {
    const match = mainUri.match(/^(mongodb(?:\+srv)?:\/\/[^\/]+\/)([^?]+)(\??.*)$/);
    if (match) {
      return `${match[1]}${match[2]}_archive${match[3]}`;
    }
    return mainUri + '_archive';
  }
}

let archiveConnection = null;
let OrderArchive = null;

function initializeArchiveDb(logger) {
  if (archiveConnection) return { connection: archiveConnection, OrderArchive };

  const mainUri = getMongoConnectionString();
  const archiveUri = getArchiveMongoConnectionString(mainUri);
  const dbName = archiveUri.match(/\/([^?\/]+)(?:\?|$)/)?.[1] || 'innovapos_archive';

  if (logger) {
    logger.info(`[archiveDb] Initializing Cold DB: ${dbName}`);
  } else {
    console.log(`[archiveDb] Initializing Cold DB: ${dbName}`);
  }

  // Create connection
  archiveConnection = mongoose.createConnection(archiveUri);

  archiveConnection.on('connected', () => {
    const msg = `[archiveDb] MongoDB Archive Database connected: ${archiveConnection.host}/${archiveConnection.name}`;
    if (logger) logger.info(msg);
    else console.log(msg);
  });

  archiveConnection.on('error', (err) => {
    const msg = `[archiveDb] MongoDB Archive Database error: ${err.message}`;
    if (logger) logger.error(msg);
    else console.error(msg);
  });

  // Define OrderArchive model reusing Order schema
  OrderArchive = archiveConnection.model('OrderArchive', Order.schema, 'orders');

  return { connection: archiveConnection, OrderArchive };
}

function getOrderArchiveModel() {
  if (!OrderArchive) {
    throw new Error('[archiveDb] Archive DB connection is not initialized. Call initializeArchiveDb() first.');
  }
  return OrderArchive;
}

module.exports = {
  initializeArchiveDb,
  getOrderArchiveModel,
};
