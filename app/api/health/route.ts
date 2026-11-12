import { xdr, rpc } from "@stellar/stellar-sdk";
import { route } from "@/lib/route";
import { get, usingMemoryStore } from "@/lib/db";
import { ASSET_ISSUER, EXPLORER_ACCOUNT, EXPLORER_CONTRACT, GIFT_EXPIRY_SECONDS, NGN_PER_USD } from "@/lib/config";
import { giftMode, horizon, sorobanRpc, sponsor, usdc } from "@/lib/stellar-server";

type Check = { name: string; ok: boolean; warn?: boolean; detail: string; link?: string };

async function safe(name: string, fn: () => Promise<Omit<Check, "name">>): Promise<Check> {
  try {
    return { name, ...(await fn()) };
  } catch (e) {
    return { name, ok: false, detail: (e as Error).message.slice(0, 160) };
  }
}

// Pre-demo checklist. Open /check in a browser for the friendly version.
export const GET = route(async () => {
  const mode = giftMode();
  const checks = await Promise.all([
    safe("Sponsor account (pays all fees)", async () => {
      const sp = sponsor();
      const a = await horizon.loadAccount(sp.publicKey());
      const xlm = Number(a.balances.find((b) => b.asset_type === "native")?.balance || 0);
      const asset = usdc();
      const float = Number(
        a.balances.find((b) => "asset_code" in b && b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer())?.balance || 0,
      );
      const low = xlm < 100 || float < 50;
      return {
        ok: xlm > 20,
        warn: low,
        detail: `${xlm.toFixed(0)} XLM · ${float.toFixed(2)} USDC${low ? " (low: top up the sponsor)" : ""}`,
        link: EXPLORER_ACCOUNT(sp.publicKey()),
      };
    }),
    safe("USDC asset", async () => ({
      ok: !!ASSET_ISSUER,
      detail: !ASSET_ISSUER
        ? "NEXT_PUBLIC_ASSET_ISSUER missing"
        : ASSET_ISSUER === "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
          ? "Circle testnet USDC (official)"
          : `Gbam test USDC · ${ASSET_ISSUER.slice(0, 8)}…`,
    })),
    safe("Database", async () => {
      if (usingMemoryStore()) return { ok: false, warn: true, detail: "In-memory only. Fine on a laptop, breaks on Vercel. Add SUPABASE_* vars." };
      await get("profile", "healthcheck");
      return { ok: true, detail: "Supabase connected" };
    }),
    safe("Receipt AI", async () => {
      if (process.env.ANTHROPIC_API_KEY) return { ok: true, detail: `Claude · ${process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"}` };
      if (process.env.GEMINI_API_KEY) return { ok: true, detail: `Gemini (free tier) · ${process.env.GEMINI_MODEL || "gemini-2.5-flash"}` };
      return { ok: true, warn: true, detail: "No AI key. Only the demo receipt will work. Add a free GEMINI_API_KEY." };
    }),
    safe(`Gift engine: ${mode === "contract" ? "Soroban escrow contract" : "classic claimable balances"}`, async () => {
      const id = process.env.GIFT_CONTRACT_ID;
      if (mode === "classic") return { ok: true, detail: id ? "Contract deployed but not switched on (GIFT_MODE=classic)." : "Using claimable balances." };
      if (!id) return { ok: false, detail: "GIFT_MODE=contract but GIFT_CONTRACT_ID is missing." };
      await sorobanRpc.getContractData(id, xdr.ScVal.scvLedgerKeyContractInstance(), rpc.Durability.Persistent);
      return { ok: true, detail: `Contract live: ${id.slice(0, 8)}…`, link: EXPLORER_CONTRACT(id) };
    }),
    safe("Demo settings", async () => ({
      ok: true,
      warn: GIFT_EXPIRY_SECONDS > 600,
      detail: `Take-back after ${GIFT_EXPIRY_SECONDS >= 3600 ? `${GIFT_EXPIRY_SECONDS / 3600}h` : `${GIFT_EXPIRY_SECONDS}s`}${GIFT_EXPIRY_SECONDS > 600 ? " (set NEXT_PUBLIC_GIFT_EXPIRY_SECONDS=120 to demo it live)" : ""} · ₦${NGN_PER_USD} = $1`,
    })),
  ]);
  return { ok: checks.every((c) => c.ok), checks };
});