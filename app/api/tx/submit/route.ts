import { route, body } from "@/lib/route";
import { patch } from "@/lib/db";
import { AppError, decodeTx, submit, verifyIntent, type Intent } from "@/lib/stellar-server";
import type { Gift, Share } from "@/lib/types";

// Single submit endpoint: verify the signed XDR is exactly what we prepared, fee-bump, submit,
// then record the result.
export const POST = route(async (req) => {
  const b = await body<{ xdr: string; intent: Intent; token: string }>(req);
  const tx = decodeTx(b.xdr);
  if (!b.intent || !verifyIntent(tx, b.intent, b.token)) throw new AppError("This request expired. Try again.", 400);

  const hash = await submit(tx);
  const i = b.intent;
  switch (i.type) {
    case "gift_create":
      await patch<Gift>("gift", i.giftId, { status: "active", createTx: hash });
      break;
    case "gift_claim":
      await patch<Gift>("gift", i.giftId, { status: "claimed", claimedBy: i.receiver, claimedAt: Date.now(), claimTx: hash });
      break;
    case "gift_reclaim":
      await patch<Gift>("gift", i.giftId, { status: "reclaimed", reclaimTx: hash });
      break;
    case "share_pay":
      await patch<Share>("share", i.shareId, { status: "paid", paidBy: i.from, paidAt: Date.now(), tx: hash });
      break;
  }
  return { hash };
});
