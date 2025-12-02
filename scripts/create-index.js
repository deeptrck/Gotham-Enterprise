// scripts/create-index.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  const db = mongoose.connection.db;
  const collName = 'verificationresults';
  
  try {
    const coll = db.collection(collName);
    
    // Get current indexes
    console.log('\n📊 Current indexes:');
    const currentIndexes = await coll.indexes();
    currentIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, index.key);
    });

    // Create compound index for optimized queries
    console.log('\n🔧 Creating compound index: { userId: 1, createdAt: -1 }');
    const indexName = await coll.createIndex(
      { userId: 1, createdAt: -1 }, 
      { 
        background: true,
        name: 'user_scan_history'
      }
    );
    console.log('✅ Index created:', indexName);

    // Create additional useful indexes
    console.log('\n🔧 Creating scanId index for faster lookups');
    await coll.createIndex(
      { scanId: 1 },
      { 
        background: true,
        name: 'scan_id_lookup',
        unique: false // Set to true if scanId should be unique across all users
      }
    );

    console.log('\n🔧 Creating status index for filtering');
    await coll.createIndex(
      { status: 1, createdAt: -1 },
      { 
        background: true,
        name: 'status_history'
      }
    );

    // Verify new indexes
    console.log('\n📊 Updated indexes:');
    const updatedIndexes = await coll.indexes();
    updatedIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}:`, index.key);
    });

    // Show collection stats
    console.log('\n📈 Collection stats:');
    const stats = await coll.stats();
    console.log('Total documents:', stats.count);
    console.log('Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Indexes size:', (stats.totalIndexSize / 1024 / 1024).toFixed(2), 'MB');

  } catch (err) {
    console.error('❌ Error creating indexes:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

run().catch((err) => { 
  console.error('❌ Script failed:', err); 
  process.exit(1); 
});