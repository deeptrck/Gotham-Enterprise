// scripts/diagnose-performance.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  console.log('🔍 Connecting to MongoDB...');
  try {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  const db = mongoose.connection.db;
  const collName = 'verificationresults';

  try {
    const coll = db.collection(collName);

    // Get collection stats
    console.log('📊 Collection Statistics:');
    console.log('━'.repeat(50));
    const stats = await db.command({ collStats: collName });
    console.log(`Total documents: ${stats.count.toLocaleString()}`);
    console.log(`Average document size: ${(stats.avgObjSize / 1024).toFixed(2)} KB`);
    console.log(`Total size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Storage size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total indexes: ${stats.nindexes}`);
    console.log(`Index size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);

    // List all indexes
    console.log('\n🗂️  Current Indexes:');
    console.log('━'.repeat(50));
    const indexes = await coll.indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. Name: ${index.name}`);
      console.log(`   Keys: ${JSON.stringify(index.key)}`);
      if (index.unique) console.log(`   Unique: true`);
      console.log('');
    });

    // Sample data distribution
    console.log('📈 Data Distribution by User:');
    console.log('━'.repeat(50));
    const userCounts = await coll.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    console.log('Top 10 users by scan count:');
    userCounts.forEach((user, i) => {
      console.log(`${i + 1}. UserId: ${user._id}: ${user.count.toLocaleString()} scans`);
    });

    // Test query performance with explain
    if (userCounts.length > 0) {
      const testUserId = userCounts[0]._id;
      console.log(`\n⚡ Testing Query Performance for user: ${testUserId}`);
      console.log('━'.repeat(50));

      const startTime = Date.now();
      const explain = await coll.find({ userId: testUserId })
        .sort({ createdAt: -1 })
        .limit(20)
        .explain('executionStats');
      const duration = Date.now() - startTime;

      console.log(`Query execution time: ${duration}ms`);
      console.log(`Docs examined: ${explain.executionStats.totalDocsExamined}`);
      console.log(`Docs returned: ${explain.executionStats.nReturned}`);
      console.log(`Index used: ${explain.executionStats.executionStages?.indexName || 'COLLSCAN (no index!)'}`);
      
      if (explain.executionStats.totalDocsExamined > explain.executionStats.nReturned * 10) {
        console.log('⚠️  WARNING: Query is examining too many documents!');
        console.log('   Consider optimizing indexes or query structure.');
      }

      if (duration > 1000) {
        console.log('⚠️  WARNING: Query took more than 1 second!');
        console.log('   This indicates a performance issue.');
      }
    }

    // Check for missing indexes
    console.log('\n💡 Recommendations:');
    console.log('━'.repeat(50));
    const hasCompoundIndex = indexes.some(idx => 
      JSON.stringify(idx.key) === '{"userId":1,"createdAt":-1}'
    );
    
    if (!hasCompoundIndex) {
      console.log('❌ Missing compound index on {userId: 1, createdAt: -1}');
      console.log('   Run: node scripts/create-index.js');
    } else {
      console.log('✅ Compound index exists');
    }

    if (stats.count > 10000) {
      console.log('⚠️  Large collection detected. Consider:');
      console.log('   - Implementing data archival for old scans');
      console.log('   - Upgrading MongoDB Atlas tier for better performance');
      console.log('   - Adding more aggressive caching');
    }

  } catch (err) {
    console.error('❌ Error during analysis:', err);
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
