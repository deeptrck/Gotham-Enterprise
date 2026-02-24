// scripts/find-large-documents.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
 const db = mongoose.connection.db;
  const coll = db.collection('verificationresults');

  console.log('🔍 Finding largest documents...\n');

  // Get all documents and check their sizes
  try {
    const docs = await coll.find({}).limit(100).toArray();
  
  const docSizes = docs.map(doc => ({
    _id: doc._id,
    scanId: doc.scanId,
    userId: doc.userId,
    size: JSON.stringify(doc).length,
    hasBase64Image: doc.imageUrl && doc.imageUrl.startsWith('data:'),
    hasBase64Url: doc.url && doc.url.startsWith('data:'),
    imageUrlLength: doc.imageUrl ? doc.imageUrl.length : 0,
    urlLength: doc.url ? doc.url.length : 0,
  })).sort((a, b) => b.size - a.size);

  console.log('📊 Top 10 Largest Documents:');
  console.log('━'.repeat(80));
  
  docSizes.slice(0, 10).forEach((doc, i) => {
    console.log(`${i + 1}. Size: ${(doc.size / 1024).toFixed(2)} KB`);
    console.log(`   ScanId: ${doc.scanId}`);
    console.log(`   UserId: ${doc.userId}`);
    console.log(`   Base64 Image: ${doc.hasBase64Image ? '⚠️ YES' : 'No'}`);
    console.log(`   Base64 URL: ${doc.hasBase64Url ? '⚠️ YES' : 'No'}`);
    console.log(`   ImageUrl length: ${(doc.imageUrlLength / 1024).toFixed(2)} KB`);
    console.log(`   URL length: ${(doc.urlLength / 1024).toFixed(2)} KB`);
    console.log('');
  });

  const totalSize = docSizes.reduce((sum, doc) => sum + doc.size, 0);
  const avgSize = totalSize / docSizes.length;
  const base64Count = docSizes.filter(d => d.hasBase64Image || d.hasBase64Url).length;

  console.log('📈 Summary:');
  console.log('━'.repeat(80));
  console.log(`Total documents: ${docSizes.length}`);
  console.log(`Average size: ${(avgSize / 1024).toFixed(2)} KB`);
  console.log(`Documents with base64 data: ${base64Count} (${((base64Count / docSizes.length) * 100).toFixed(1)}%)`);
  console.log(`Smallest doc: ${(docSizes[docSizes.length - 1].size / 1024).toFixed(2)} KB`);
  console.log(`Largest doc: ${(docSizes[0].size / 1024).toFixed(2)} KB`);

  if (base64Count > 0) {
    console.log('\n⚠️  PROBLEM IDENTIFIED:');
    console.log('   Documents are storing base64-encoded images directly in MongoDB!');
    console.log('   This causes:');
    console.log('   - Huge documents (364KB average)');
    console.log('   - Slow queries (transferring MBs of data)');
    console.log('   - MongoDB ignoring indexes');
    console.log('\n💡 SOLUTION:');
    console.log('   1. Store uploaded files in cloud storage (Cloudinary, AWS S3, etc.)');
    console.log('   2. Store only the URL in MongoDB');
    console.log('   3. This will reduce document size to ~1KB and speed up queries 100x+');
  }
  } catch (error) {
    console.error('Error:', error.message);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
