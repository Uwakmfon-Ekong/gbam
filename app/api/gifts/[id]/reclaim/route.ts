import { route, body, pubKey } from "@/lib/route";
import { get } from "@/lib/db";
import { AppError, loadAccount, prepareSoroban, signIntent, PASSPHRASE, type Intent } from "@/lib/stellar-server";
import { buildReclaim } from "@/lib/txbuilders";
import { buildContractRefund } from "@/lib/soroban";
import type { Gift } from "@/lib/types";

export const POST = route(async (req, { id }) => {
  const sender = pubKey((await body(req)).sender);
  const g = await get<Gift>("gift", id);
  if (!g) throw new AppError("Gift not found", 404);
  if (g.sender !== sender) throw new AppError("Only the sender can take this back.", 403);
  if (g.status !== "active") throw new AppError(g.status === "claimed" ? "Already claimed." : "Already taken back.", 409);
  if (Date.now() < g.expiresAt) throw new AppError("You can take it back once the 24 hours are up.");
  const senderAccount = await loadAccount(sender);
  const tx =
    g.mode === "contract"
      ? await prepareSoroban(buildContractRefund({ senderAccount, contractId: g.contractId!, linkPub: g.linkPub, passphrase: PASSPHRASE }))
      : buildReclaim({ senderAccount, balanceId: g.balanceId!, passphrase: PASSPHRASE });
  const intent: Intent = { type: "gift_reclaim", giftId: id };
  return { prepared: { xdr: tx.toXDR(), intent, token: signIntent(tx, intent) } };
});
