const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set in environment. Load your .env or export the variable.');
  process.exit(2);
}

async function main() {
  try {
    await mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });

    const VerificationResult = mongoose.models.VerificationResult || mongoose.model('VerificationResult');

    const count = await VerificationResult.countDocuments({}).exec();
    console.log('VerificationResult count:', count);

    const recent = await VerificationResult.find({}).sort({ createdAt: -1 }).limit(10).lean().exec();
    console.log('Recent docs (up to 10):');
    recent.forEach((d, i) => {
      console.log(i + 1, {
        _id: d._id,
        scanId: d.scanId,
        userId: d.userId,
        fileName: d.fileName,
        fileType: d.fileType,
        status: d.status,
        confidenceScore: d.confidenceScore,
        createdAt: d.createdAt,
      });
    });

    process.exit(0);
  } catch (err) {
    console.error('DB inspect failed:', err);
    process.exit(1);
  }
}

main();
