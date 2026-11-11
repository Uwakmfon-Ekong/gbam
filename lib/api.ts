"use client";
import type { Keypair } from "@stellar/stellar-sdk";
import { ASSET_CODE, ASSET_ISSUER, HORIZON_URL } from "./config";
import { signXdr } from "./wallet";

export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status})`);
  return data as T;
}

export type Prepared = { xdr: string; intent: unknown; token: string };

/** Sign a server-prepared tx on this device, then the server fee-bumps and submits it. */
export async function signAndSubmit<T = { hash: string }>(p: Prepared, ...signers: Keypair[]): Promise<T> {
  const xdr = signXdr(p.xdr, ...signers);
  return api<T>("/api/tx/submit", { xdr, intent: p.intent, token: p.token });
}

/** USDC balance straight from Horizon (null = account not on-chain yet). */
export async function fetchBalance(pub: string): Promise<number | null> {
  const r = await fetch(`${HORIZON_URL}/accounts/${pub}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Couldn't load balance");
  const a = await r.json();
  const b = (a.balances || []).find(
    (x: { asset_code?: string; asset_issuer?: string }) => x.asset_code === ASSET_CODE && x.asset_issuer === ASSET_ISSUER,
  );
  return b ? Number(b.balance) : 0;
}
