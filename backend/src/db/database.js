const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const models = require('./models');
const { GTBIT_SOCIETIES } = require('./societiesData');

let connectPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectPromise) return connectPromise;

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gtbit_erp';
  if (uri.includes('<username>') || uri.includes('<password>') || uri.includes('<cluster>')) {
    console.warn('⚠️  MONGO_URI still contains placeholder credentials. Set your real MongoDB Atlas URI in backend/.env.');
  }

  connectPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000
  }).then(async (conn) => {
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    await ensureSocieties();
    return conn.connection;
  }).catch((err) => {
    connectPromise = null;
    console.error('MongoDB connection error:', err.message);
    throw err;
  });

  return connectPromise;
}

async function ensureSocieties() {
  try {
    const existingCount = await models.Society.countDocuments();
    if (existingCount === 0) {
      for (const s of GTBIT_SOCIETIES) {
        const id = await models.getNextId('societies');
        await models.Society.updateOne(
          { name: s.name },
          { $setOnInsert: { id, name: s.name, description: s.description, category: s.category } },
          { upsert: true }
        );
      }
      console.log(`Bootstrapped ${GTBIT_SOCIETIES.length} GTBIT societies in MongoDB.`);
    }
  } catch (err) {
    console.warn('Society bootstrap skipped:', err.message);
  }
}

module.exports = {
  connectDB,
  mongoose,
  ...models
};
