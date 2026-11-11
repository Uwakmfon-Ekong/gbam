import { route } from "@/lib/route";
import { get } from "@/lib/db";
import { AppError } from "@/lib/stellar-server";
import type { Gift } from "@/lib/types";

export const GET = route(async (_req, { id }) => {
  const g = await get<Gift>("gift", id);
  if (!g || g.status === "pending") throw new AppError("Gift not found", 404);
  return { gift: g, now: Date.now() };
});
