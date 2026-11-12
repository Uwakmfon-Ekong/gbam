// One-time testnet setup. Creates:
//   • a SPONSOR account (pays every fee + reserve, and holds the test USDC float)
//   • an ISSUER account for a test "USDC" asset you fully control (mint as much as the demo needs)
// …funds both with Friendbot, mints 1,000,000 test USDC to the sponsor, and writes .env.local.
//
// Run:  npm run setup:stellar
// Re-running reuses existing keys from .env.local and just tops things up.
import fs from "node:fs";
import { Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const HORIZON = "https://horizon-testnet.stellar.org";
const server = new Horizon.Server(HORIZON);
const ENV = ".env.local";

const env = fs.existsSync(ENV)
  ? Object.fromEntries(
      fs.readFileSync(ENV, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
    )
  : {};

// --circle → use Circle's official testnet USDC (no minting; fill the sponsor from faucet.circle.com).
const CIRCLE_TESTNET_USDC = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const CIRCLE = process.argv.includes("--circle");
const sponsor = env.SPONSOR_SECRET ? Keypair.fromSecret(env.SPONSOR_SECRET) : Keypair.random();
const issuer = CIRCLE ? null : env.ISSUER_SECRET ? Keypair.fromSecret(env.ISSUER_SECRET) : Keypair.random();
const issuerPub = CIRCLE ? CIRCLE_TESTNET_USDC : issuer.publicKey();
const usdc = new Asset("USDC", issuerPub);

async function friendbot(pub) {
  try {
    await server.loadAccount(pub);
    console.log("  exists", pub.slice(0, 8));
  } catch {
    const r = await fetch(`https://friendbot.stellar.org/?addr=${pub}`);
    if (!r.ok) throw new Error(`Friendbot failed for ${pub}: ${r.status} ${await r.text()}`);
    console.log("  funded", pub.slice(0, 8), "with 10,000 XLM");
  }
}

async function send(kp, ops) {
  const acc = await server.loadAccount(kp.publicKey());
  const b = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET }).setTimeout(60);
  ops.forEach((o) => b.addOperation(o));
  const tx = b.build();
  tx.sign(kp);
  return server.submitTransaction(tx);
}

console.log(`Using ${CIRCLE ? "Circle's official testnet USDC" : "Gbam's own test USDC"}`);
console.log("1/3 Funding accounts with Friendbot…");
await friendbot(sponsor.publicKey());
if (!CIRCLE) await friendbot(issuer.publicKey());

console.log("2/3 Sponsor trusts USDC…");
const sp = await server.loadAccount(sponsor.publicKey());
const has = sp.balances.find((b) => b.asset_code === "USDC" && b.asset_issuer === issuerPub);
if (!has) await send(sponsor, [Operation.changeTrust({ asset: usdc })]);

if (CIRCLE) {
  console.log("3/3 Skipping minting (Circle issues this token).");
} else {
  console.log("3/3 Minting 1,000,000 test USDC to sponsor…");
  if (!has || Number(has.balance) < 100000) {
    await send(issuer, [Operation.payment({ destination: sponsor.publicKey(), asset: usdc, amount: "1000000" })]);
  }
}

const next = {
  ...env,
  NEXT_PUBLIC_HORIZON_URL: env.NEXT_PUBLIC_HORIZON_URL || HORIZON,
  NEXT_PUBLIC_NETWORK_PASSPHRASE: Networks.TESTNET,
  NEXT_PUBLIC_ASSET_CODE: "USDC",
  NEXT_PUBLIC_ASSET_ISSUER: issuerPub,
  SPONSOR_SECRET: sponsor.secret(),
  ISSUER_SECRET: CIRCLE ? "" : issuer.secret(),
  FAUCET_AMOUNT: CIRCLE ? (env.FAUCET_AMOUNT && env.FAUCET_AMOUNT !== "25" ? env.FAUCET_AMOUNT : "5") : env.FAUCET_AMOUNT || "25",
  NEXT_PUBLIC_NGN_PER_USD: env.NEXT_PUBLIC_NGN_PER_USD || "1500",
  NEXT_PUBLIC_GIFT_EXPIRY_SECONDS: env.NEXT_PUBLIC_GIFT_EXPIRY_SECONDS || "86400",
  ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || "",
  ANTHROPIC_MODEL: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  SUPABASE_URL: env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || "",
};
fs.writeFileSync(ENV, Object.entries(next).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");

console.log(`
✅ Done. Wrote ${ENV}
   Sponsor: https://stellar.expert/explorer/testnet/account/${sponsor.publicKey()}
   Asset:   USDC:${issuerPub}${CIRCLE ? " (Circle testnet)" : ""}
${CIRCLE ? `
👉 Fill the sponsor with Circle testnet USDC:
   1. Open https://faucet.circle.com
   2. Choose "USDC" and network "Stellar Testnet"
   3. Paste this address and request tokens (repeat a few times for a demo float):
      ${sponsor.publicKey()}
` : ""}
Next: npm run proof`);