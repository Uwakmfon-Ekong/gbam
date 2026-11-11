import { route, body, pubKey, clean } from "@/lib/route";
import { get, listBy, put } from "@/lib/db";
import { AppError } from "@/lib/stellar-server";
import { sanitizeAssign, sanitizeCharges, sanitizeFriends, sanitizeItems } from "@/lib/split-server";
import type { Share, Split } from "@/lib/types";

export const GET = route(async (_req, { id }) => {
  const split = await get<Split>("split", id);
  if (!split) throw new AppError("Split not found", 404);
  const shares = split.status === "sent" ? await listBy<Share>("share", "splitId", id) : [];
  return { split, shares };
});

// Save edits to a draft (items, charges, friends, who-had-what).
export const POST = route(async (req, { id }) => {
  const b = await body(req);
  const split = await get<Split>("split", id);
  if (!split) throw new AppError("Split not found", 404);
  if (pubKey(b.payer) !== split.payer) throw new AppError("Only the bill payer can edit this.", 403);
  if (split.status === "sent") throw new AppError("Links were already sent for this bill.", 409);
  const items = sanitizeItems(b.items ?? split.items);
  let friends = sanitizeFriends(b.friends ?? split.friends);
  if (!friends.some((f) => f.isPayer)) friends = [{ ...split.friends[0] }, ...friends];
  const next: Split = {
    ...split,
    merchant: clean(b.merchant ?? split.merchant, 60),
    items,
    charges: sanitizeCharges(b.charges ?? split.charges),
    friends,
    assign: sanitizeAssign(b.assign ?? split.assign, items, friends),
  };
  await put("split", id, next);
  return { split: next };
});
