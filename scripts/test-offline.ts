// Offline checks: transaction shapes + split math. No network needed.
// Run: npm test
import assert from "node:assert/strict";
import { Account, Asset, Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  buildActivate,
  buildClaimGift,
  buildCreateGift,
  buildPayment,
  buildReclaim,
  feeBump,
} from "../lib/txbuilders.ts";
import { computeShares, DEMO_RECEIPT, grandTotal, mathMismatch, parseNaira } from "../lib/split.ts";

const P = Networks.TESTNET;
const issuer = Keypair.random();
const usdc = new Asset("USDC", issuer.publicKey());
const sponsor = Keypair.random();
const sender = Keypair.random();
const receiver = Keypair.random();
const link = Keypair.random();
const acct = (k: Keypair, seq = "100") => new Account(k.publicKey(), seq);
let passed = 0;
const ok = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log("  ✓", name);
};

console.log("Transactions");
ok("activate: sponsor-sourced, sponsored createAccount + trustline", () => {
  const tx = buildActivate({ sponsorAccount: acct(sponsor), userPub: sender.publicKey(), asset: usdc, passphrase: P });
  assert.equal(tx.source, sponsor.publicKey());
  assert.deepEqual(
    tx.operations.map((o) => o.type),
    ["beginSponsoringFutureReserves", "createAccount", "changeTrust", "endSponsoringFutureReserves"],
  );
  assert.equal(tx.operations[2].source, sender.publicKey());
});

let balanceId = "";
ok("create gift: two claimants, sponsored entry, deterministic balance id", () => {
  const { tx, balanceId: id } = buildCreateGift({
    senderAccount: acct(sender),
    sponsorPub: sponsor.publicKey(),
    linkPub: link.publicKey(),
    asset: usdc,
    amount: "10.00",
    expirySeconds: 86400,
    passphrase: P,
  });
  balanceId = id;
  assert.equal(tx.source, sender.publicKey());
  const cb = tx.operations[1] as unknown as { type: string; claimants: { destination: string }[] };
  assert.equal(cb.type, "createClaimableBalance");
  assert.deepEqual(cb.claimants.map((c) => c.destination), [link.publicKey(), sender.publicKey()]);
  assert.equal(tx.operations[0].source, sponsor.publicKey());
  assert.match(id, /^[0-9a-f]{72}$/);
  // Same inputs → same id (lets us store it before submitting)
  const again = buildCreateGift({
    senderAccount: acct(sender),
    sponsorPub: sponsor.publicKey(),
    linkPub: link.publicKey(),
    asset: usdc,
    amount: "10.00",
    expirySeconds: 86400,
    passphrase: P,
  });
  assert.equal(again.balanceId, id);
});

ok("claim: receiver-sourced, 3 signers, survives XDR round trip, fee-bumped by sponsor", () => {
  const tx = buildClaimGift({
    receiverAccount: acct(receiver),
    sponsorPub: sponsor.publicKey(),
    linkPub: link.publicKey(),
    balanceId,
    asset: usdc,
    amount: "10.00",
    passphrase: P,
  });
  assert.equal(tx.operations.length, 7);
  tx.sign(sponsor); // server, at prepare time
  const onClient = new Transaction(tx.toXDR(), P);
  onClient.sign(receiver, link); // receiver's device
  const back = TransactionBuilder.fromXDR(onClient.toXDR(), P) as Transaction;
  assert.equal(back.signatures.length, 3);
  assert.equal(Buffer.from(back.hash()).toString("hex"), Buffer.from(tx.hash()).toString("hex"), "hash stable across signing");
  const fb = feeBump(back, sponsor, P);
  assert.equal(fb.feeSource, sponsor.publicKey());
  assert.equal(fb.signatures.length, 1);
});

ok("reclaim + payment are single-op user txs", () => {
  assert.equal(buildReclaim({ senderAccount: acct(sender), balanceId, passphrase: P }).operations.length, 1);
  const pay = buildPayment({ fromAccount: acct(receiver), toPub: sender.publicKey(), asset: usdc, amount: "4.20", passphrase: P });
  assert.equal(pay.operations[0].type, "payment");
});

console.log("Split math");
ok("parseNaira handles receipt formats", () => {
  assert.equal(parseNaira("N4,500.00"), 4500);
  assert.equal(parseNaira("₦ 12,000"), 12000);
  assert.equal(parseNaira("NGN3500.50"), 3500.5);
  assert.equal(parseNaira(900), 900);
  assert.equal(parseNaira("abc"), 0);
});

const items = DEMO_RECEIPT.items.map((i, n) => ({ ...i, id: `i${n}` }));
const charges = { tax: DEMO_RECEIPT.tax, service: DEMO_RECEIPT.service, tip: 0 };
ok("demo receipt adds up", () => {
  assert.equal(grandTotal(items, charges), DEMO_RECEIPT.total);
  assert.equal(mathMismatch(items, charges, DEMO_RECEIPT.total), null);
  assert.ok(mathMismatch(items, charges, 30000));
});

ok("shared items + proportional tax sum back to the bill", () => {
  const friends = ["Tomi", "Ada", "Chidi"].map((name, i) => ({ id: `f${i}`, name, color: "#fff" }));
  const assign: Record<string, string[]> = {
    i0: ["f0"],
    i1: ["f1"],
    i2: ["f0", "f1", "f2"],
    i3: ["f2"],
    i4: ["f0", "f1"],
    i5: ["f0", "f1", "f2"],
  };
  const { shares, unassigned } = computeShares({ items, charges, friends, assign, rate: 1500 });
  assert.equal(unassigned.length, 0);
  const sum = shares.reduce((s, x) => s + x.totalNgn, 0);
  assert.ok(Math.abs(sum - DEMO_RECEIPT.total) < 0.05, `sum ${sum}`);
  assert.ok(shares[0].labels.includes("⅓ of Suya platter"));
  assert.ok(shares[0].labels.includes("½ of 2× Chapman"));
  assert.equal(shares[0].usd, Math.round((shares[0].totalNgn / 1500) * 100) / 100);
});

console.log(`\n${passed} checks passed`);
