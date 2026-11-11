/**
 * Builders for the Gbam gift-escrow Soroban contract (contracts/gift-escrow).
 * No secrets, no app imports — shared by the API routes, the browser and the scripts.
 * These return UNPREPARED transactions; run them through `rpc.Server.prepareTransaction`
 * (simulation adds resource fees + auth) before signing.
 */
import { Account, Address, BASE_FEE, Contract, Keypair, nativeToScVal, TransactionBuilder } from "@stellar/stellar-sdk";

const toStroops = (amount: string) => {
  const [w, f = ""] = amount.split(".");
  return BigInt(w) * 10_000_000n + BigInt((f + "0000000").slice(0, 7));
};

const linkBytes = (linkPub: string) => nativeToScVal(Keypair.fromPublicKey(linkPub).rawPublicKey(), { type: "bytes" });

function call(source: Account, contractId: string, passphrase: string, method: string, ...args: ReturnType<typeof nativeToScVal>[]) {
  return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(300)
    .build();
}

/** Bytes the link key signs to authorize a claim: the XDR of ScVal::Address(to). */
export function claimMessage(to: string): Uint8Array {
  return new Address(to).toScVal().toXDR();
}

/** Run on the receiver's device: the link key signs "pay this to <to>". Returns hex. */
export function signClaim(linkKey: Keypair, to: string): string {
  const sig = linkKey.sign(claimMessage(to) as Parameters<Keypair["sign"]>[0]);
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildContractCreate(opts: {
  senderAccount: Account;
  contractId: string;
  linkPub: string;
  amount: string; // "10.00"
  windowSeconds: number;
  passphrase: string;
}) {
  const { senderAccount, contractId, linkPub, amount, windowSeconds, passphrase } = opts;
  return call(
    senderAccount,
    contractId,
    passphrase,
    "create",
    new Address(senderAccount.accountId()).toScVal(),
    linkBytes(linkPub),
    nativeToScVal(toStroops(amount), { type: "i128" }),
    nativeToScVal(BigInt(windowSeconds), { type: "u64" }),
  );
}

export function buildContractClaim(opts: {
  sourceAccount: Account; // the receiver (fee-bumped by the app)
  contractId: string;
  linkPub: string;
  to: string;
  sigHex: string;
  passphrase: string;
}) {
  const { sourceAccount, contractId, linkPub, to, sigHex, passphrase } = opts;
  if (!/^[0-9a-f]{128}$/i.test(sigHex)) throw new Error("Bad claim signature");
  return call(
    sourceAccount,
    contractId,
    passphrase,
    "claim",
    linkBytes(linkPub),
    new Address(to).toScVal(),
    nativeToScVal(Buffer.from(sigHex, "hex"), { type: "bytes" }),
  );
}

export function buildContractRefund(opts: { senderAccount: Account; contractId: string; linkPub: string; passphrase: string }) {
  return call(opts.senderAccount, opts.contractId, opts.passphrase, "refund", linkBytes(opts.linkPub));
}

/** True if this tx calls a contract (submitted via Soroban RPC instead of Horizon). */
export const isSorobanTx = (tx: { operations: { type: string }[] }) => tx.operations[0]?.type === "invokeHostFunction";

export { toStroops };
