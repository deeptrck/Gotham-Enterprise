import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  clerkId: string;
  email: string;
  fullName: string;
  imageUrl?: string;
  credits: number;
  creditsUsed?: number;
  scanCount?: number;
  plan: "trial" | "starter" | "growth" | "enterprise";
  trialUsed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    imageUrl: { type: String },
    credits: { type: Number, default: 10 },
    creditsUsed: { type: Number, default: 0 },
    scanCount: { type: Number, default: 0 },
    plan: { type: String, enum: ["trial", "starter", "growth", "enterprise"], default: "trial" },
    trialUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);
// Note: Indexes on clerkId and email are automatically created by unique: true
export const User = mongoose.models?.User || mongoose.model("User", userSchema);
