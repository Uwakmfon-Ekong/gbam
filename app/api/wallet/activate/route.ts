import { route, body, pubKey, clean } from "@/lib/route";
import { accountExists, loadAccount, signIntent, sponsor, usdc, PASSPHRASE, type Intent } from "@/lib/stellar-server";
import { buildActivate } from "@/lib/txbuilders";
import { put } from "@/lib/db";

// Creates the user's on-chain account (0 XLM, sponsored) + USDC trustline.
export const POST = route(async (req) => {
  const b = await body(req);
  const pub = pubKey(b.pub);
  const name = clean(b.name, 40) || "Gbam user";
  await put("profile", pub, { pub, name, updatedAt: Date.now() });
  if (await accountExists(pub)) return { ready: true };
  const sp = sponsor();
  const tx = buildActivate({ sponsorAccount: await loadAccount(sp.publicKey()), userPub: pub, asset: usdc(), passphrase: PASSPHRASE });
  tx.sign(sp);
  const intent: Intent = { type: "activate", pub };
  return { ready: false, prepared: { xdr: tx.toXDR(), intent, token: signIntent(tx, intent) } };
});
