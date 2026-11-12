import { route, body, pubKey, clean } from "@/lib/route";
import { accountExists, hasTrustline, loadAccount, signIntent, sponsor, usdc, PASSPHRASE, type Intent } from "@/lib/stellar-server";
import { buildActivate, buildAddTrustline } from "@/lib/txbuilders";
import { put } from "@/lib/db";

// Creates the user's on-chain account (0 XLM, sponsored) + USDC trustline.
// If the account exists but doesn't trust the current USDC (e.g. after switching to Circle's), adds the trustline.
export const POST = route(async (req) => {
  const b = await body(req);
  const pub = pubKey(b.pub);
  const name = clean(b.name, 40) || "Gbam user";
  await put("profile", pub, { pub, name, updatedAt: Date.now() });
  const sp = sponsor();
  let tx;
  if (await accountExists(pub)) {
    if (await hasTrustline(pub)) return { ready: true };
    tx = buildAddTrustline({ sponsorAccount: await loadAccount(sp.publicKey()), userPub: pub, asset: usdc(), passphrase: PASSPHRASE });
  } else {
    tx = buildActivate({ sponsorAccount: await loadAccount(sp.publicKey()), userPub: pub, asset: usdc(), passphrase: PASSPHRASE });
  }
  tx.sign(sp);
  const intent: Intent = { type: "activate", pub };
  return { ready: false, prepared: { xdr: tx.toXDR(), intent, token: signIntent(tx, intent) } };
});