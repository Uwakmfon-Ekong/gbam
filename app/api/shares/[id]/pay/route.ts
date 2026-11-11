import { route, body, pubKey } from "@/lib/route";
import { get } from "@/lib/db";
import { AppError, loadAccount, signIntent, usdc, PASSPHRASE, type Intent } from "@/lib/stellar-server";
import { buildPayment } from "@/lib/txbuilders";
import type { Share } from "@/lib/types";

export const POST = route(async (req, { id }) => {
  const from = pubKey((await body(req)).from);
  const share = await get<Share>("share", id);
  if (!share) throw new AppError("Payment link not found", 404);
  if (share.status === "paid") throw new AppError("This share is already paid. 🎉", 409);
  if (from === share.payer) throw new AppError("This is your own bill. Send the link to your friend.");
  const tx = buildPayment({ fromAccount: await loadAccount(from), toPub: share.payer, asset: usdc(), amount: share.amountUsd, passphrase: PASSPHRASE });
  const intent: Intent = { type: "share_pay", shareId: id, from };
  return { prepared: { xdr: tx.toXDR(), intent, token: signIntent(tx, intent) } };
});
