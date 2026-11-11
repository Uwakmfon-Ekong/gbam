"use client";
import { useState } from "react";
import { useWallet } from "./wallet-context";
import { ErrorBox, FingerprintIcon, Spinner } from "./ui";
import type { SavedWallet } from "@/lib/wallet";

/** One passkey button. A wallet is created (and activated on-chain) behind the scenes. */
export function SignInBlock({ onDone, cta = "Continue with fingerprint" }: { onDone?: (w: SavedWallet) => void; cta?: string }) {
  const { signUp, restore } = useWallet();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"new" | "old" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "new" | "old") {
    setError(null);
    setBusy(kind);
    try {
      const w = kind === "new" ? await signUp(name) : await restore();
      onDone?.(w);
    } catch (e) {
      setError((e as Error).message || "Couldn't sign in. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <label style={{ display: "grid", gap: 8 }}>
        <span className="label">What do friends call you?</span>
        <input className="field" placeholder="e.g. Tomiwa" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      </label>
      <button className="btn btn-green btn-block" disabled={!!busy} onClick={() => run("new")}>
        {busy === "new" ? <><Spinner /> Setting things up…</> : <><FingerprintIcon /> {cta}</>}
      </button>
      <ErrorBox error={error} />
      <button
        onClick={() => run("old")}
        disabled={!!busy}
        style={{ background: "none", border: "none", font: "inherit", fontWeight: 700, fontSize: 15, textDecoration: "underline", cursor: "pointer", color: "#3A4A3F" }}
      >
        {busy === "old" ? "Opening your passkey…" : "I've used Gbam before"}
      </button>
      <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#5B6B60", lineHeight: 1.45 }}>
        No password. No seed phrase. Your fingerprint is your key.
      </div>
    </div>
  );
}
