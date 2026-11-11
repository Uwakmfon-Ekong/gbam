import { route, body, pubKey } from "@/lib/route";
import { get, listBy, newId, put } from "@/lib/db";
import { AppError } from "@/lib/stellar-server";
import { computeShares } from "@/lib/split";
import type { Share, Split } from "@/lib/types";

// Lock the bill and create one payment link per friend.
export const POST = route(async (req, { id }) => {
  const b = await body(req);
  const split = await get<Split>("split", id);
  if (!split) throw new AppError("Split not found", 404);
  if (pubKey(b.payer) !== split.payer) throw new AppError("Only the bill payer can send links.", 403);
  if (split.status === "sent") return { shares: await listBy<Share>("share", "splitId", id) };

  const { shares, unassigned } = computeShares(split);
  if (unassigned.length) throw new AppError(`Assign "${unassigned[0].name}" to someone first.`);
  const owing = shares.filter((s) => !s.friend.isPayer && s.totalNgn > 0);
  if (!owing.length) throw new AppError("Add a friend and give them something they ate.");

  const now = Date.now();
  const records: Share[] = owing.map((s, i) => ({
    id: newId(),
    splitId: id,
    friendId: s.friend.id,
    name: s.friend.name,
    color: s.friend.color,
    payer: split.payer,
    payerName: split.payerName,
    merchant: split.merchant,
    items: s.labels,
    amountNgn: s.totalNgn,
    amountUsd: s.usd.toFixed(2),
    status: "unpaid",
    createdAt: now + i, // keeps friend order stable
  }));
  for (const r of records) await put("share", r.id, r);
  await put("split", id, { ...split, status: "sent" });
  return { shares: records };
});
