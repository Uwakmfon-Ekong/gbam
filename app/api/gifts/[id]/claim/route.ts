import { route, body, pubKey } from "@/lib/route";
import { get } from "@/lib/db";
import { AppError, loadAccount, prepareSoroban, signIntent, sponsor, usdc, PASSPHRASE, type Intent } from "@/lib/stellar-server";
import { buildClaimGift } from "@/lib/txbuilders";
import { buildContractClaim } from "@/lib/soroban";
import type { Gift } from "@/lib/types";

// Builds the claim tx.
//  classic:  one atomic tx; the receiver's device adds its signature AND the link-key signature.
//  contract: the device sends the link key's signature over its own address (`sig`); the contract verifies it.
export const POST = route(async (req, { id }) => {
  const b = await body<{ receiver: string; sig?: string }>(req);
  const receiver = pubKey(b.receiver);
  const g = await get<Gift>("gift", id);
  if (!g || g.status === "pending") throw new AppError("Gift not found", 404);
  if (g.status === "claimed") throw new AppError("This gift was already claimed.", 409);
  if (g.status === "reclaimed") throw new AppError("The sender took this gift back.", 409);
  if (Date.now() > g.expiresAt) throw new AppError("This gift expired. Ask the sender to send it again.", 410);
  if (receiver === g.sender) throw new AppError("You can't claim your own gift. Send the link to a friend!");
  const receiverAccount = await loadAccount(receiver);

  let tx;
  if (g.mode === "contract") {
    if (!b.sig) throw new AppError("Missing link signature");
    tx = await prepareSoroban(
      buildContractClaim({ sourceAccount: receiverAccount, contractId: g.contractId!, linkPub: g.linkPub, to: receiver, sigHex: b.sig, passphrase: PASSPHRASE }),
    );
  } else {
    const sp = sponsor();
    tx = buildClaimGift({
      receiverAccount,
      sponsorPub: sp.publicKey(),
      linkPub: g.linkPub,
      balanceId: g.balanceId!,
      asset: usdc(),
      amount: g.amount,
      passphrase: PASSPHRASE,
    });
    tx.sign(sp);
  }
  const intent: Intent = { type: "gift_claim", giftId: id, receiver };
  return { prepared: { xdr: tx.toXDR(), intent, token: signIntent(tx, intent) } };
});
