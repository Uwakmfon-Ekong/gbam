// Server-only Stellar helper. Holds the sponsor secret — never import from a client component.
import { createHmac, timingSafeEqual } from "crypto";
import {
  Account,
  Asset,
  FeeBumpTransaction,
  Horizon,
  Keypair,
  rpc,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { ASSET_CODE, ASSET_ISSUER, HORIZON_URL, NETWORK_PASSPHRASE, SOROBAN_RPC_URL } from "./config";
import { feeBump } from "./txbuilders";
import { isSorobanTx } from "./soroban";
import type { GiftMode } from "./types";

export const PASSPHRASE = NETWORK_PASSPHRASE;
export const horizon = new Horizon.Server(HORIZON_URL);
export const sorobanRpc = new rpc.Server(SOROBAN_RPC_URL);

/** Which gift engine new gifts use. Flip to "contract" once `npm run proof:contract` passes. */
export function giftMode(): GiftMode {
  const m = process.env.GIFT_MODE || process.env.NEXT_PUBLIC_GIFT_MODE;
  return m === "contract" ? "contract" : "classic";
}

export function giftContractId(): string {
  const id = process.env.GIFT_CONTRACT_ID;
  if (!id) throw new AppError("Server is missing GIFT_CONTRACT_ID. Run `npm run deploy:contract`.", 500);
  return id;
}

/** Simulate a contract call so it carries resource fees + auth. */
export async function prepareSoroban(tx: Transaction): Promise<Transaction> {
  try {
    return await sorobanRpc.prepareTransaction(tx);
  } catch (e) {
    throw new AppError(friendlySorobanError(e), 400);
  }
}

export function sponsor(): Keypair {
  const s = process.env.SPONSOR_SECRET;
  if (!s) throw new AppError("Server is missing SPONSOR_SECRET. Run `npm run setup:stellar`.", 500);
  return Keypair.fromSecret(s);
}

export function usdc(): Asset {
  if (!ASSET_ISSUER) throw new AppError("Server is missing NEXT_PUBLIC_ASSET_ISSUER.", 500);
  return new Asset(ASSET_CODE, ASSET_ISSUER);
}

export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function loadAccount(pub: string): Promise<Account> {
  try {
    const a = await horizon.loadAccount(pub);
    return new Account(a.accountId(), a.sequenceNumber());
  } catch (e: unknown) {
    if (isNotFound(e)) throw new AppError("This wallet isn't set up yet. Sign in again.", 404);
    throw e;
  }
}

export async function accountExists(pub: string) {
  try {
    await horizon.loadAccount(pub);
    return true;
  } catch (e) {
    if (isNotFound(e)) return false;
    throw e;
  }
}

export async function usdcBalance(pub: string): Promise<number> {
  const a = await horizon.loadAccount(pub);
  const asset = usdc();
  const b = a.balances.find(
    (x) => "asset_code" in x && x.asset_code === asset.getCode() && x.asset_issuer === asset.getIssuer(),
  );
  return b ? Number(b.balance) : 0;
}

function isNotFound(e: unknown) {
  const r = (e as { response?: { status?: number } })?.response;
  return r?.status === 404 || (e as { name?: string })?.name === "NotFoundError";
}

// ─── Prepare → client signs → submit. A short HMAC token ties the signed XDR to what we built. ───

export type Intent =
  | { type: "activate"; pub: string }
  | { type: "gift_create"; giftId: string }
  | { type: "gift_claim"; giftId: string; receiver: string }
  | { type: "gift_reclaim"; giftId: string }
  | { type: "share_pay"; shareId: string; from: string };

function key() {
  return createHmac("sha256", "gbam-intent").update(process.env.SPONSOR_SECRET || "dev").digest();
}

export function signIntent(tx: Transaction, intent: Intent) {
  return createHmac("sha256", key()).update(Buffer.from(tx.hash()).toString("hex") + JSON.stringify(intent)).digest("hex");
}

export function verifyIntent(tx: Transaction, intent: Intent, token: string) {
  const want = Buffer.from(signIntent(tx, intent), "hex");
  const got = Buffer.from(String(token || ""), "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

export function decodeTx(xdr: string): Transaction {
  const t = TransactionBuilder.fromXDR(xdr, PASSPHRASE);
  if (t instanceof FeeBumpTransaction) throw new AppError("Unexpected fee-bump XDR");
  return t;
}

/** Fee-bump (unless the sponsor is already the source) and submit. Returns the hash. */
export async function submit(tx: Transaction): Promise<string> {
  if (isSorobanTx(tx)) return submitSoroban(tx);
  const sp = sponsor();
  const envelope = tx.source === sp.publicKey() ? tx : feeBump(tx, sp, PASSPHRASE);
  try {
    const res = await horizon.submitTransaction(envelope);
    return res.hash;
  } catch (e) {
    throw new AppError(friendlyHorizonError(e), 400);
  }
}

export function friendlyHorizonError(e: unknown): string {
  const data = (e as { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } })
    ?.response?.data;
  const codes = data?.extras?.result_codes;
  if (!codes) return (e as Error)?.message || "Network error. Try again.";
  const ops = codes.operations || [];
  const map: Record<string, string> = {
    op_underfunded: "Not enough money in your Gbam for this.",
    op_cannot_claim: "This gift can't be claimed anymore. It may have expired or already been claimed.",
    op_does_not_exist: "This gift was already claimed or taken back.",
    op_no_trust: "This wallet isn't set up to receive money yet.",
    op_low_reserve: "The app's sponsor account is low on XLM. Top it up with Friendbot.",
    op_already_exists: "That account already exists.",
    op_line_full: "Receiver can't hold that much.",
  };
  for (const op of ops) if (map[op]) return map[op];
  if (codes.transaction === "tx_bad_seq") return "Out of sync. Please try again.";
  if (codes.transaction === "tx_too_late") return "Took too long to confirm. Please try again.";
  if (codes.transaction === "tx_insufficient_fee") return "Network is busy. Please try again.";
  return `Payment failed (${[codes.transaction, ...ops].filter(Boolean).join(", ")})`;
}

async function submitSoroban(tx: Transaction): Promise<string> {
  const fb = feeBump(tx, sponsor(), PASSPHRASE);
  const sent = await sorobanRpc.sendTransaction(fb);
  if (sent.status === "ERROR") throw new AppError(friendlySorobanError(sent.errorResult?.toXDR("base64") || "send failed"));
  if (sent.status === "TRY_AGAIN_LATER") throw new AppError("Network is busy. Please try again.");
  const res = await sorobanRpc.pollTransaction(sent.hash, { attempts: 30, sleepStrategy: () => 1000 });
  if (res.status !== "SUCCESS") throw new AppError(res.status === "NOT_FOUND" ? "Still confirming. Refresh in a moment." : "The contract rejected this. Try again.");
  return sent.hash;
}

/** Gift-escrow contract errors (see contracts/gift-escrow) + common SAC/auth failures. */
export function friendlySorobanError(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  const code = /Error\(Contract, #(\d+)\)/.exec(m)?.[1];
  const ours: Record<string, string> = {
    "1": "This gift link was already used.",
    "2": "This gift was already claimed or taken back.",
    "3": "This gift expired. Ask the sender to send it again.",
    "4": "You can take it back once the time is up.",
    "5": "Amount must be more than zero.",
    "6": "Invalid gift window.",
    "10": "Not enough money in your Gbam for this.",
  };
  if (code && ours[code]) return ours[code];
  if (/Crypto/.test(m)) return "This link doesn't match the gift. Ask the sender to share it again.";
  if (/trustline|TrustLine/i.test(m)) return "This wallet isn't set up to receive money yet.";
  if (/balance/i.test(m)) return "Not enough money in your Gbam for this.";
  return "The gift contract said no. Try again.";
}
