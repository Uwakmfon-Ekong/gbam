import { route, body, pubKey, clean } from "@/lib/route";
import { newId, put } from "@/lib/db";
import { NGN_PER_USD } from "@/lib/config";
import { sanitizeCharges, sanitizeItems } from "@/lib/split-server";
import type { Split } from "@/lib/types";

export const POST = route(async (req) => {
  const b = await body(req);
  const payer = pubKey(b.payer);
  const payerName = clean(b.payerName, 24) || "Me";
  const total = Number(b.receiptTotal);
  const split: Split = {
    id: newId(),
    payer,
    payerName,
    merchant: clean(b.merchant, 60),
    rate: NGN_PER_USD,
    items: sanitizeItems(b.items),
    charges: sanitizeCharges(b.charges),
    receiptTotal: Number.isFinite(total) && total > 0 ? total : null,
    friends: [{ id: "me", name: payerName, color: "#12E26B", isPayer: true }],
    assign: {},
    status: "draft",
    createdAt: Date.now(),
  };
  await put("split", split.id, split);
  return { id: split.id };
});
