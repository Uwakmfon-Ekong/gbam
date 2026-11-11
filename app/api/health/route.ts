import { route } from "@/lib/route";
import { usingMemoryStore } from "@/lib/db";
import { ASSET_ISSUER } from "@/lib/config";
import { giftMode } from "@/lib/stellar-server";

// Quick pre-demo check: open /api/health on the deployed URL.
export const GET = route(async () => ({
  sponsor: !!process.env.SPONSOR_SECRET,
  asset: !!ASSET_ISSUER,
  claude: !!process.env.ANTHROPIC_API_KEY,
  giftMode: giftMode(),
  giftContract: process.env.GIFT_CONTRACT_ID || (giftMode() === "contract" ? "MISSING" : "not deployed"),
  database: usingMemoryStore() ? "memory (NOT OK on Vercel)" : "supabase",
}));
