// scripts/check-document-size.js
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

  // Get a sample document
  const sample = await coll.findOne({});
  
  if (!sample) {
    console.log('No documents found');
    process.exit(0);
  }

  console.log('📄 Sample Document Analysis:');
  console.log('━'.repeat(50));
  
  const docSize = JSON.stringify(sample).length;
  console.log(`Total document size: ${(docSize / 1024).toFixed(2)} KB`);
  console.log('\nField sizes:');
  
  for (const [key, value] of Object.entries(sample)) {
    const fieldSize = JSON.stringify(value).length;
    const pct = ((fieldSize / docSize) * 100).toFixed(1);
    if (fieldSize > 1000) {
      console.log(`  ${key}: ${(fieldSize / 1024).toFixed(2)} KB (${pct}%) ⚠️`);
    } else {
      console.log(`  ${key}: ${fieldSize} bytes`);
    }
  }

  // Check if imageUrl or url contains base64 data
  if (sample.imageUrl && sample.imageUrl.startsWith('data:')) {
    console.log('\n⚠️  WARNING: imageUrl contains base64 data URI!');
    console.log('   This is causing massive documents and slow queries.');
    console.log('   Solution: Store images in cloud storage (S3, Cloudinary, etc.)');
  }

  if (sample.url && sample.url.startsWith('data:')) {
    console.log('\n⚠️  WARNING: url contains base64 data URI!');
    console.log('   This is causing massive documents and slow queries.');
    console.log('   Solution: Store files in cloud storage.');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
