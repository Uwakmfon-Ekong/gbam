import { route, body, pubKey } from "@/lib/route";
import { get } from "@/lib/db";
import { AppError, loadAccount, signIntent, sponsor, usdc, PASSPHRASE, type Intent } from "@/lib/stellar-server";
import { buildClaimGift } from "@/lib/txbuilders";
import type { Gift } from "@/lib/types";

// Builds the one-shot claim tx. The receiver's device adds its own signature and the link-key signature.
export const POST = route(async (req, { id }) => {
  const receiver = pubKey((await body(req)).receiver);
  const g = await get<Gift>("gift", id);
  if (!g || g.status === "pending") throw new AppError("Gift not found", 404);
  if (g.status === "claimed") throw new AppError("This gift was already claimed.", 409);
  if (g.status === "reclaimed") throw new AppError("The sender took this gift back.", 409);
  if (Date.now() > g.expiresAt) throw new AppError("This gift expired. Ask the sender to send it again.", 410);
  if (receiver === g.sender) throw new AppError("You can't claim your own gift. Send the link to a friend!");
  const sp = sponsor();
  const tx = buildClaimGift({
    receiverAccount: await loadAccount(receiver),
    sponsorPub: sp.publicKey(),
    linkPub: g.linkPub,
    balanceId: g.balanceId,
    asset: usdc(),
    amount: g.amount,
    passphrase: PASSPHRASE,
  });
  tx.sign(sp);
  const intent: Intent = { type: "gift_claim", giftId: id, receiver };
  return { prepared: { xdr: tx.toXDR(), intent, token: signIntent(tx, intent) } };
});
