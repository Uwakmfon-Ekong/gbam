// End-to-end proof of the Soroban gift escrow on testnet, using the app's own builders.
// Same story as `npm run proof`, but gifts go through our contract instead of claimable balances.
// Run: npm run proof:contract   (after deploy:contract)
import fs from "node:fs";
import { Account, Asset, Horizon, Keypair, Networks, rpc, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { buildActivate, buildFaucet } from "../lib/txbuilders.ts";
import { buildContractClaim, buildContractCreate, buildContractRefund, signClaim } from "../lib/soroban.ts";

const env: Record<string, string> = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const P = Networks.TESTNET;
const horizon = new Horizon.Server(env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org");
const soroban = new rpc.Server(env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org");
const sponsor = Keypair.fromSecret(env.SPONSOR_SECRET);
const usdc = new Asset("USDC", env.NEXT_PUBLIC_ASSET_ISSUER);
const C = env.GIFT_CONTRACT_ID;
if (!C) throw new Error("GIFT_CONTRACT_ID missing — run npm run deploy:contract");

const load = async (pub: string) => {
  const a = await horizon.loadAccount(pub);
  return new Account(a.accountId(), a.sequenceNumber());
};
const bal = async (pub: string) =>
  (await horizon.loadAccount(pub)).balances.find((b) => "asset_code" in b && b.asset_code === "USDC")?.balance;

async function classic(tx: Transaction, label: string) {
  const r = await horizon.submitTransaction(tx);
  console.log(`  ✓ ${label}  https://stellar.expert/explorer/testnet/tx/${r.hash}`);
}

/** Simulate → user signs → sponsor fee-bumps → send via RPC → wait. Exactly what the app does. */
async function sorobanTx(unprepared: Transaction, signer: Keypair, label: string) {
  const prepared = await soroban.prepareTransaction(unprepared);
  prepared.sign(signer);
  const fb = TransactionBuilder.buildFeeBumpTransaction(sponsor, "200", prepared, P);
  fb.sign(sponsor);
  const sent = await soroban.sendTransaction(fb);
  if (sent.status === "ERROR") throw new Error(`${label}: ${sent.errorResult?.toXDR("base64")}`);
  const res = await soroban.pollTransaction(sent.hash, { attempts: 30 });
  if (res.status !== "SUCCESS") throw new Error(`${label} failed (${res.status})`);
  console.log(`  ✓ ${label}  https://stellar.expert/explorer/testnet/tx/${sent.hash}`);
}

const sender = Keypair.random();
const receiver = Keypair.random();

console.log("1. Two 0-XLM wallets");
for (const k of [sender, receiver]) {
  const tx = buildActivate({ sponsorAccount: await load(sponsor.publicKey()), userPub: k.publicKey(), asset: usdc, passphrase: P });
  tx.sign(sponsor, k);
  await classic(tx, `activate ${k.publicKey().slice(0, 6)}`);
}
{
  const tx = buildFaucet({ sponsorAccount: await load(sponsor.publicKey()), userPub: sender.publicKey(), asset: usdc, amount: "15", passphrase: P });
  tx.sign(sponsor);
  await classic(tx, "faucet $15");
}

console.log("2. Gift $10 into the escrow contract");
const link = Keypair.random();
await sorobanTx(
  buildContractCreate({ senderAccount: await load(sender.publicKey()), contractId: C, linkPub: link.publicKey(), amount: "10", windowSeconds: 86400, passphrase: P }),
  sender,
  "create",
);

console.log("3. Receiver claims with a link-key signature");
await sorobanTx(
  buildContractClaim({ sourceAccount: await load(receiver.publicKey()), contractId: C, linkPub: link.publicKey(), to: receiver.publicKey(), sigHex: signClaim(link, receiver.publicKey()), passphrase: P }),
  receiver,
  "claim",
);
console.log("   receiver:", await bal(receiver.publicKey()), "USDC");

console.log("4. Take-back: 5s gift, wait, refund");
const link2 = Keypair.random();
await sorobanTx(
  buildContractCreate({ senderAccount: await load(sender.publicKey()), contractId: C, linkPub: link2.publicKey(), amount: "5", windowSeconds: 5, passphrase: P }),
  sender,
  "create 5s gift",
);
await new Promise((r) => setTimeout(r, 15000));
await sorobanTx(buildContractRefund({ senderAccount: await load(sender.publicKey()), contractId: C, linkPub: link2.publicKey(), passphrase: P }), sender, "refund");
console.log("   sender:", await bal(sender.publicKey()), "USDC");
console.log(`\n✅ Soroban gift escrow works. https://stellar.expert/explorer/testnet/contract/${C}`);