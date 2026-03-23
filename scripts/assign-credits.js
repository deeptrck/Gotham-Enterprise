// scripts/assign-credits.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

// Define User schema inline to avoid import issues
const userSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  imageUrl: { type: String },
  credits: { type: Number, default: 5 },
  plan: { type: String, enum: ["trial", "starter", "growth", "enterprise"], default: "trial" },
}, { timestamps: true });

const User = mongoose.models?.User || mongoose.model("User", userSchema);

async function assignCredits(email, credits) {
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

  try {
    // Find the user by email
    const user = await User.findOne({ email: email });
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    // Update credits
    user.credits = credits;
    await user.save();

    console.log(`✅ Successfully assigned ${credits} credits to ${email}`);
    console.log(`User details:`, {
      email: user.email,
      fullName: user.fullName,
      credits: user.credits,
      plan: user.plan
    });

  } catch (err) {
    console.error('❌ Error updating user:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Get email and credits from command line arguments
const email = process.argv[2];
const credits = parseInt(process.argv[3]);

if (!email || isNaN(credits)) {
  console.error('Usage: node assign-credits.js <email> <credits>');
  console.error('Example: node assign-credits.js hejalbertoescorcia@gmail.com 1000');
  process.exit(1);
}

assignCredits(email, credits);