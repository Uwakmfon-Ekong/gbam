// Deploys the Gbam gift-escrow contract to testnet.
//   1. Wraps our test USDC in its Stellar Asset Contract (SAC) so Soroban can move it
//   2. Uploads contracts/gift-escrow wasm
//   3. Deploys it with the SAC address as constructor arg
//   4. Writes GIFT_CONTRACT_ID + NEXT_PUBLIC_SOROBAN_RPC_URL to .env.local
//
// Prereq:  stellar contract build   (inside ./contracts)   — or:
//          rustup target add wasm32v1-none && cargo build --target wasm32v1-none --release
// Run:     npm run deploy:contract
import fs from "node:fs";
import crypto from "node:crypto";
import { Address, Asset, BASE_FEE, Keypair, Networks, Operation, rpc, scValToNative, TransactionBuilder, xdr } from "@stellar/stellar-sdk";

const ENV = ".env.local";
const env: Record<string, string> = Object.fromEntries(
  fs.readFileSync(ENV, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const RPC = env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const P = Networks.TESTNET;
const server = new rpc.Server(RPC);
const sponsor = Keypair.fromSecret(env.SPONSOR_SECRET);
const usdc = new Asset("USDC", env.NEXT_PUBLIC_ASSET_ISSUER);

const WASM = ["contracts/target/wasm32v1-none/release/gift_escrow.wasm", "contracts/target/wasm32-unknown-unknown/release/gift_escrow.wasm"].find((p) => fs.existsSync(p));
if (!WASM) {
  console.error("No wasm found. Run `cd contracts && stellar contract build` first.");
  process.exit(1);
}

async function run(op: xdr.Operation, label: string) {
  const acc = await server.getAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: P }).addOperation(op).setTimeout(120).build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(sponsor);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`${label}: ${JSON.stringify(sent.errorResult)}`);
  const res = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (res.status !== "SUCCESS") throw new Error(`${label} failed: ${res.status}`);
  console.log(`  ✓ ${label}  https://stellar.expert/explorer/testnet/tx/${sent.hash}`);
  return res.returnValue;
}

const sacId = usdc.contractId(P);
console.log("1/3 Test USDC asset contract:", sacId);
try {
  await run(Operation.createStellarAssetContract({ asset: usdc }), "deploy USDC SAC");
} catch (e) {
  const m = String((e as Error).message);
  if (/ExistingValue|already exists|contract already/i.test(m)) console.log("  (already deployed)");
  else throw e;
}

console.log("2/3 Uploading gift-escrow wasm…", WASM);
const wasm = fs.readFileSync(WASM);
const hashVal = await run(Operation.uploadContractWasm({ wasm }), "upload wasm");
const wasmHash = hashVal ? Buffer.from(scValToNative(hashVal)) : crypto.createHash("sha256").update(wasm).digest();

console.log("3/3 Deploying gift-escrow…");
const created = await run(
  Operation.createCustomContract({
    address: new Address(sponsor.publicKey()),
    wasmHash,
    salt: crypto.randomBytes(32),
    constructorArgs: [new Address(sacId).toScVal()],
  }),
  "deploy contract",
);
const contractId = scValToNative(created!) as string;

const next = { ...env, NEXT_PUBLIC_SOROBAN_RPC_URL: RPC, USDC_SAC_ID: sacId, GIFT_CONTRACT_ID: contractId };
fs.writeFileSync(ENV, Object.entries(next).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
console.log(`
✅ Gift escrow live: https://stellar.expert/explorer/testnet/contract/${contractId}
Next: npm run proof:contract   then set NEXT_PUBLIC_GIFT_MODE=contract`);
