import { route, body, pubKey, money, clean } from "@/lib/route";
import { loadAccount, signIntent, sponsor, usdc, PASSPHRASE, type Intent, AppError } from "@/lib/stellar-server";
import { buildCreateGift } from "@/lib/txbuilders";
import { listBy, newId, put } from "@/lib/db";
import { GIFT_EXPIRY_SECONDS } from "@/lib/config";
import type { Gift } from "@/lib/types";

// Prepare a gift. The client generated the link key and keeps its secret; we only see the public key.
export const POST = route(async (req) => {
  const b = await body(req);
  const sender = pubKey(b.sender);
  const linkPub = pubKey(b.linkPub, "link");
  const amount = money(b.amount, { max: 500 });
  const { tx, balanceId } = buildCreateGift({
    senderAccount: await loadAccount(sender),
    sponsorPub: sponsor().publicKey(),
    linkPub,
    asset: usdc(),
    amount,
    expirySeconds: GIFT_EXPIRY_SECONDS,
    passphrase: PASSPHRASE,
  });
  tx.sign(sponsor());
  const gift: Gift = {
    id: newId(),
    sender,
    senderName: clean(b.senderName, 40) || "a friend",
    amount,
    message: clean(b.message, 140),
    linkPub,
    balanceId,
    status: "pending",
    createdAt: Date.now(),
    // small buffer so the UI never shows "Take it back" a few seconds before the chain allows it
    expiresAt: Date.now() + GIFT_EXPIRY_SECONDS * 1000 + 15000,
  };
  await put("gift", gift.id, gift);
  const intent: Intent = { type: "gift_create", giftId: gift.id };
  return { id: gift.id, prepared: { xdr: tx.toXDR(), intent, token: signIntent(tx, intent) } };
});

export const GET = route(async (req) => {
  const sender = new URL(req.url).searchParams.get("sender");
  if (!sender) throw new AppError("sender required");
  const gifts = await listBy<Gift>("gift", "sender", pubKey(sender));
  return { gifts: gifts.filter((g) => g.status !== "pending").sort((a, b) => b.createdAt - a.createdAt).slice(0, 10) };
});
