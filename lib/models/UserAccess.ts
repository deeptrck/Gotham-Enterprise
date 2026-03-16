import mongoose, { Schema, Document } from "mongoose";

export interface IUserAccess extends Document {
  clerkId: string;
  email: string;
  accessType: "page_visit" | "api_call";
  routePath: string; // e.g., "/dashboard", "/api/results"
  method?: string; // HTTP method for API calls (GET, POST, etc.)
  userAgent?: string;
  ipAddress?: string;
  lastAccessedAt: Date;
  createdAt: Date;
}

const userAccessSchema = new Schema<IUserAccess>(
  {
    clerkId: { type: String, required: true, index: true },
    email: { type: String, required: true, index: true },
    accessType: {
      type: String,
      enum: ["page_visit", "api_call"],
      required: true,
    },
    routePath: { type: String, required: true },
    method: { type: String }, // For API calls: GET, POST, etc.
    userAgent: { type: String },
    ipAddress: { type: String },
    lastAccessedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Create a compound index for efficient queries
userAccessSchema.index({ clerkId: 1, lastAccessedAt: -1 });
userAccessSchema.index({ email: 1, lastAccessedAt: -1 });
userAccessSchema.index({ lastAccessedAt: -1 }); // For finding active users

// TTL index: automatically delete records older than 999 days if desired
// Uncomment to enable: userAccessSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 999 });

export const UserAccess =
  mongoose.models?.UserAccess ||
  mongoose.model("UserAccess", userAccessSchema);
