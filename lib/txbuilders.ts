/**
 * Pure transaction builders. No network, no secrets — so they can be unit tested offline
 * and shared by the API routes and the proof script.
 *
 * Fee model: every user transaction is built with the USER as source (their own sequence
 * number) and is later wrapped in a fee-bump paid by the app's sponsor account. Users never
 * hold XLM. Reserves for new accounts, trustlines and claimable balances are paid with
 * sponsored reserves (CAP-33), so the sponsor co-signs the transactions that need it.
 */
import {
  Account,
  Asset,
  BASE_FEE,
  Claimant,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

export type Built = { tx: Transaction };

function builder(source: Account, passphrase: string) {
  return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase }).setTimeout(300);
}

/** Creates the user's account with 0 XLM + a USDC trustline. Reserves paid by the sponsor. */
export function buildActivate(opts: {
  sponsorAccount: Account;
  userPub: string;
  asset: Asset;
  passphrase: string;
}): Transaction {
  const { sponsorAccount, userPub, asset, passphrase } = opts;
  return builder(sponsorAccount, passphrase)
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: userPub }))
    .addOperation(Operation.createAccount({ destination: userPub, startingBalance: "0" }))
    .addOperation(Operation.changeTrust({ asset, source: userPub }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: userPub }))
    .build();
}

/** Sends test USDC from the sponsor/distributor. Stands in for a naira on-ramp. */
export function buildFaucet(opts: {
  sponsorAccount: Account;
  userPub: string;
  asset: Asset;
  amount: string;
  passphrase: string;
}): Transaction {
  return builder(opts.sponsorAccount, opts.passphrase)
    .addOperation(Operation.payment({ destination: opts.userPub, asset: opts.asset, amount: opts.amount }))
    .build();
}

/**
 * Gift = claimable balance with two claimants:
 *   1. a throwaway "link key" (its secret lives in the link's #fragment) — can claim BEFORE expiry
 *   2. the sender — can claim only AFTER expiry (on-chain take-back)
 * The balance entry's reserve is sponsored by the app.
 */
export function buildCreateGift(opts: {
  senderAccount: Account;
  sponsorPub: string;
  linkPub: string;
  asset: Asset;
  amount: string;
  expirySeconds: number;
  passphrase: string;
}): { tx: Transaction; balanceId: string } {
  const { senderAccount, sponsorPub, linkPub, asset, amount, expirySeconds, passphrase } = opts;
  const senderPub = senderAccount.accountId();
  const window = Claimant.predicateBeforeRelativeTime(String(expirySeconds));
  const tx = builder(senderAccount, passphrase)
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: senderPub, source: sponsorPub }))
    .addOperation(
      Operation.createClaimableBalance({
        asset,
        amount,
        claimants: [new Claimant(linkPub, window), new Claimant(senderPub, Claimant.predicateNot(window))],
      }),
    )
    .addOperation(Operation.endSponsoringFutureReserves({}))
    .build();
  // Deterministic: derived from source account + sequence + op index.
  const balanceId = tx.getClaimableBalanceId(1);
  return { tx, balanceId };
}

/**
 * Claim, in ONE atomic transaction (source = receiver, fee-bumped by the app):
 *   sponsor creates the link-key account (0 XLM, sponsored) → link key opens a USDC trustline →
 *   link key claims the balance → pays it all to the receiver → closes its trustline.
 * Signed by: receiver (tx source), sponsor (sponsorship ops), link key (its ops).
 * Note: the link-key account can't be merged in the same ledger it was created
 * (ACCOUNT_MERGE_SEQNUM_TOO_FAR), so a sponsored empty account is left behind (1 XLM of sponsor reserve).
 */
export function buildClaimGift(opts: {
  receiverAccount: Account;
  sponsorPub: string;
  linkPub: string;
  balanceId: string;
  asset: Asset;
  amount: string;
  passphrase: string;
}): Transaction {
  const { receiverAccount, sponsorPub, linkPub, balanceId, asset, amount, passphrase } = opts;
  const receiverPub = receiverAccount.accountId();
  return builder(receiverAccount, passphrase)
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: linkPub, source: sponsorPub }))
    .addOperation(Operation.createAccount({ destination: linkPub, startingBalance: "0", source: sponsorPub }))
    .addOperation(Operation.changeTrust({ asset, source: linkPub }))
    .addOperation(Operation.claimClaimableBalance({ balanceId, source: linkPub }))
    .addOperation(Operation.payment({ destination: receiverPub, asset, amount, source: linkPub }))
    .addOperation(Operation.changeTrust({ asset, limit: "0", source: linkPub }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: linkPub }))
    .build();
}

/** Sender takes the gift back after expiry. */
export function buildReclaim(opts: { senderAccount: Account; balanceId: string; passphrase: string }): Transaction {
  return builder(opts.senderAccount, opts.passphrase)
    .addOperation(Operation.claimClaimableBalance({ balanceId: opts.balanceId }))
    .build();
}

/** A friend pays their share of a split. */
export function buildPayment(opts: {
  fromAccount: Account;
  toPub: string;
  asset: Asset;
  amount: string;
  passphrase: string;
}): Transaction {
  return builder(opts.fromAccount, opts.passphrase)
    .addOperation(Operation.payment({ destination: opts.toPub, asset: opts.asset, amount: opts.amount }))
    .build();
}

/** Every user tx is wrapped so the sponsor pays the fee. */
export function feeBump(inner: Transaction, sponsorKeypair: import("@stellar/stellar-sdk").Keypair, passphrase: string) {
  const fb = TransactionBuilder.buildFeeBumpTransaction(sponsorKeypair, "200", inner, passphrase);
  fb.sign(sponsorKeypair);
  return fb;
}
