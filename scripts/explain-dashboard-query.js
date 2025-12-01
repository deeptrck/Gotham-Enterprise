// scripts/explain-dashboard-query.js
// Connects to MongoDB using .env.local and runs explain() for the dashboard query
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const coll = db.collection('verificationresults');

  const sample = await coll.findOne({}, { projection: { userId: 1 } });
  if (!sample) {
    console.error('No documents found in verificationresults');
    await mongoose.disconnect();
    process.exit(1);
  }

  const userId = sample.userId;
  console.log('Using sample userId:', userId);

  // Run explain on the same query used by the dashboard
  const cursor = coll.find({ userId }).sort({ createdAt: -1 }).limit(100).project({ _id: 1, scanId: 1, fileName: 1, status: 1, confidenceScore: 1, createdAt: 1, fileType: 1, imageUrl: 1 });

  const explain = await cursor.explain('executionStats');
  console.log('Explain result (truncated):');
  // Print key parts
  console.log('queryPlanner:', JSON.stringify(explain.queryPlanner, null, 2));
  if (explain.executionStats) {
    console.log('executionStats.executionTimeMillis:', explain.executionStats.executionTimeMillis);
    console.log('executionStats.nReturned:', explain.executionStats.nReturned);
    console.log('executionStats.totalDocsExamined:', explain.executionStats.totalDocsExamined);
  }

  // Also print index stats
  const idxStats = await coll.aggregate([{ $indexStats: {} }]).toArray();
  console.log('indexStats:', JSON.stringify(idxStats, null, 2));

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
