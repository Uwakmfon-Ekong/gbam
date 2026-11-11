// End-to-end proof on testnet using the SAME builders the app uses.
//   1. Create two 0-XLM wallets (sender, receiver) with sponsored reserves
//   2. Faucet test USDC to the sender
//   3. Sender creates a gift for an unknown receiver (link key claimant)
//   4. Receiver claims it with the link key in ONE fee-bumped tx
//   5. Sender creates a 5-second gift, waits, and takes it back on-chain
// Run: npm run proof   (after npm run setup:stellar)
import fs from "node:fs";
import { Account, Asset, Horizon, Keypair, Networks, Transaction } from "@stellar/stellar-sdk";
import {
  buildActivate,
  buildClaimGift,
  buildCreateGift,
  buildFaucet,
  buildReclaim,
  feeBump,
} from "../lib/txbuilders.ts";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const P = Networks.TESTNET;
const server = new Horizon.Server(env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org");
const sponsor = Keypair.fromSecret(env.SPONSOR_SECRET);
const usdc = new Asset("USDC", env.NEXT_PUBLIC_ASSET_ISSUER);

const load = async (pub: string) => {
  const a = await server.loadAccount(pub);
  return new Account(a.accountId(), a.sequenceNumber());
};
const bal = async (pub: string) => {
  const a = await server.loadAccount(pub);
  const b = a.balances.find((x) => "asset_code" in x && x.asset_code === "USDC");
  const xlm = a.balances.find((x) => x.asset_type === "native");
  return `${b?.balance ?? 0} USDC, ${xlm?.balance} XLM`;
};
async function submit(tx: Transaction, label: string) {
  const env = tx.source === sponsor.publicKey() ? tx : feeBump(tx, sponsor, P);
  try {
    const r = await server.submitTransaction(env);
    console.log(`  ✓ ${label}  https://stellar.expert/explorer/testnet/tx/${r.hash}`);
  } catch (e) {
    const d = (e as { response?: { data?: { extras?: unknown } } }).response?.data?.extras;
    console.error(`  ✗ ${label}`, JSON.stringify(d ?? (e as Error).message));
    process.exit(1);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sender = Keypair.random();
const receiver = Keypair.random();

console.log("1. Activate two wallets with 0 XLM");
for (const k of [sender, receiver]) {
  const tx = buildActivate({ sponsorAccount: await load(sponsor.publicKey()), userPub: k.publicKey(), asset: usdc, passphrase: P });
  tx.sign(sponsor, k);
  await submit(tx, `activate ${k.publicKey().slice(0, 6)}`);
}

console.log("2. Faucet $20 to sender");
{
  const tx = buildFaucet({ sponsorAccount: await load(sponsor.publicKey()), userPub: sender.publicKey(), asset: usdc, amount: "20", passphrase: P });
  tx.sign(sponsor);
  await submit(tx, "faucet");
}

console.log("3. Sender creates a $10 gift (receiver unknown)");
const link = Keypair.random();
const g = buildCreateGift({
  senderAccount: await load(sender.publicKey()),
  sponsorPub: sponsor.publicKey(),
  linkPub: link.publicKey(),
  asset: usdc,
  amount: "10",
  expirySeconds: 86400,
  passphrase: P,
});
g.tx.sign(sponsor, sender);
await submit(g.tx, `create gift ${g.balanceId.slice(0, 12)}…`);

console.log("4. Receiver claims with the link key");
{
  const tx = buildClaimGift({
    receiverAccount: await load(receiver.publicKey()),
    sponsorPub: sponsor.publicKey(),
    linkPub: link.publicKey(),
    balanceId: g.balanceId,
    asset: usdc,
    amount: "10",
    passphrase: P,
  });
  tx.sign(sponsor, receiver, link);
  await submit(tx, "claim");
}
console.log("   receiver:", await bal(receiver.publicKey()));

console.log("5. Take-back: 5-second gift, wait, reclaim");
const g2 = buildCreateGift({
  senderAccount: await load(sender.publicKey()),
  sponsorPub: sponsor.publicKey(),
  linkPub: Keypair.random().publicKey(),
  asset: usdc,
  amount: "5",
  expirySeconds: 5,
  passphrase: P,
});
g2.tx.sign(sponsor, sender);
await submit(g2.tx, "create 5s gift");
console.log("   waiting 12s for expiry (ledger close time)…");
await sleep(12000);
{
  const tx = buildReclaim({ senderAccount: await load(sender.publicKey()), balanceId: g2.balanceId, passphrase: P });
  tx.sign(sender);
  await submit(tx, "reclaim");
}
console.log("   sender:", await bal(sender.publicKey()));
console.log("\n✅ Gift Links are proven on testnet. Users held 0 XLM the whole time.");
