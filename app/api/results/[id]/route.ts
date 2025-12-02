import { connectToDatabase } from "@/lib/db";
import { VerificationResult } from "@/lib/models/VerificationResult";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export interface VerificationResultType {
  fileName?: string;
  scanId: string;
  status?: string;
  confidenceScore?: number;
  createdAt: string | Date;
  fileType?: string;
  imageUrl?: string;
  description?: string;
  modelsUsed?: string[];
  features?: string[];
}

// Cache for frequently accessed results
const resultCache = new Map<string, { data: VerificationResultType; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GET: Fetch specific result by scanId
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const reqId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  console.time(`result:${reqId}:total`);

  try {
    console.time(`result:${reqId}:auth`);
    const { userId } = await auth();
    console.timeEnd(`result:${reqId}:auth`);

    if (!userId) {
      console.timeEnd(`result:${reqId}:total`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache first
    const cacheKey = `${userId}:${id}`;
    const cached = resultCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.timeEnd(`result:${reqId}:total`);
      return NextResponse.json(cached.data, { status: 200 });
    }

    console.time(`result:${reqId}:connect`);
    await connectToDatabase();
    console.timeEnd(`result:${reqId}:connect`);

    // Select relevant fields only
    console.time(`result:${reqId}:find`);
    const result = await VerificationResult.findOne({
      scanId: id,
      userId,
    })
      .select(
        "fileName scanId status confidenceScore createdAt fileType imageUrl description modelsUsed features"
      )
      .lean<VerificationResultType>() // <-- Fully typed lean()
      .maxTimeMS(10000);

    console.timeEnd(`result:${reqId}:find`);

    if (!result) {
      console.timeEnd(`result:${reqId}:total`);
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    // Cache the result
    resultCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    console.timeEnd(`result:${reqId}:total`);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error(`Error fetching result [${reqId}]:`, err);

    try {
      console.timeEnd(`result:${reqId}:total`);
    } catch {}

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a result
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const result = await VerificationResult.findOneAndDelete({
      scanId: id,
      userId,
    });

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    // Clear cache
    const cacheKey = `${userId}:${id}`;
    resultCache.delete(cacheKey);

    return NextResponse.json(
      { message: "Result deleted successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error deleting result:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
