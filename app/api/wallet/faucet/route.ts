import { route, body, pubKey } from "@/lib/route";
import { AppError, loadAccount, sponsor, submit, usdc, usdcBalance, PASSPHRASE } from "@/lib/stellar-server";
import { buildFaucet } from "@/lib/txbuilders";

// Test money. Stands in for a naira on-ramp (Paystack/Flutterwave → USDC) in production.
export const POST = route(async (req) => {
  const pub = pubKey((await body(req)).pub);
  const amount = process.env.FAUCET_AMOUNT || "25";
  if ((await usdcBalance(pub)) >= 100) throw new AppError("You already have plenty of test money.");
  const sp = sponsor();
  if ((await usdcBalance(sp.publicKey())) < Number(amount))
    throw new AppError("The app's test-money pot is empty. Top up the sponsor at faucet.circle.com (Stellar testnet).", 503);
  const tx = buildFaucet({ sponsorAccount: await loadAccount(sp.publicKey()), userPub: pub, asset: usdc(), amount, passphrase: PASSPHRASE });
  tx.sign(sp);
  return { hash: await submit(tx), amount };
});