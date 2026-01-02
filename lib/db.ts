import mongoose from "mongoose";

// Do NOT throw on import — read environment variables at runtime inside connectToDatabase.
// This prevents build-time failures when Next.js inspects modules (e.g., during page data collection).

interface CachedMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend global type to include mongoose cache (for dev hot reloads)
declare global {
  var mongoose: CachedMongoose | undefined;
}

// Use global cache to avoid multiple connections in development
const globalWithMongoose = global as typeof global & {
  mongoose?: CachedMongoose;
};

// Ensure cached always exists
const cached: CachedMongoose = globalWithMongoose.mongoose ?? {
  conn: null,
  promise: null,
};
globalWithMongoose.mongoose = cached;

export async function connectToDatabase(): Promise<typeof mongoose> {
  // Ensure MONGODB_URI is defined at runtime
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env.local"
    );
  }

  // Return existing connection if available
  if (cached.conn) return cached.conn;

  // Otherwise, create a new promise to connect
  if (!cached.promise) {
    const opts = { bufferCommands: false };
    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
