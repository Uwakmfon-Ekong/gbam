import { route } from "@/lib/route";
import { usingMemoryStore } from "@/lib/db";
import { ASSET_ISSUER } from "@/lib/config";

// Quick pre-demo check: open /api/health on the deployed URL.
export const GET = route(async () => ({
  sponsor: !!process.env.SPONSOR_SECRET,
  asset: !!ASSET_ISSUER,
  claude: !!process.env.ANTHROPIC_API_KEY,
  database: usingMemoryStore() ? "memory (NOT OK on Vercel)" : "supabase",
}));
