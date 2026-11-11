import { route } from "@/lib/route";
import { get } from "@/lib/db";
import { AppError } from "@/lib/stellar-server";
import type { Share } from "@/lib/types";

export const GET = route(async (_req, { id }) => {
  const share = await get<Share>("share", id);
  if (!share) throw new AppError("Payment link not found", 404);
  return { share };
});
