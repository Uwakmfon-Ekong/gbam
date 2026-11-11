import { route, body, pubKey } from "@/lib/route";
import { get, patch } from "@/lib/db";
import { AppError } from "@/lib/stellar-server";
import type { Share } from "@/lib/types";

// The bill payer marks a friend as settled outside Gbam (cash, bank transfer).
export const POST = route(async (req, { id }) => {
  const payer = pubKey((await body(req)).payer);
  const share = await get<Share>("share", id);
  if (!share) throw new AppError("Payment link not found", 404);
  if (share.payer !== payer) throw new AppError("Only the person who paid the bill can do this.", 403);
  if (share.status === "paid") return { share };
  return { share: await patch<Share>("share", id, { status: "paid", method: "cash", paidAt: Date.now() }) };
});
