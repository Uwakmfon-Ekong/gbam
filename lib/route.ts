import { NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { AppError } from "./stellar-server";

type Ctx = { params: Promise<Record<string, string>> };

/** Wraps an API handler: JSON out, friendly errors, no caching. */
export function route(fn: (req: Request, params: Record<string, string>) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const params = ctx?.params ? await ctx.params : {};
      const data = await fn(req, params);
      return NextResponse.json(data ?? {}, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      const status = e instanceof AppError ? e.status : 500;
      if (status >= 500) console.error(e);
      const message = e instanceof Error ? e.message : "Something went wrong";
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError("Bad request");
  }
}

export function pubKey(v: unknown, what = "wallet"): string {
  if (typeof v !== "string" || !StrKey.isValidEd25519PublicKey(v)) throw new AppError(`Invalid ${what} address`);
  return v;
}

export function money(v: unknown, { min = 0.01, max = 10000 } = {}): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new AppError(`Amount must be at least $${min}`);
  if (n > max) throw new AppError(`Max is $${max} on the demo`);
  return n.toFixed(2);
}

export const clean = (v: unknown, max = 140) => (typeof v === "string" ? v.trim().slice(0, max) : "");
