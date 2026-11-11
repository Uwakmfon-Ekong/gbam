"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Keypair } from "@stellar/stellar-sdk";
import { AppShell, ArrowIcon, ErrorBox, GiftIcon, Spinner } from "@/components/ui";
import { SignInBlock } from "@/components/signin-card";
import { useWallet } from "@/components/wallet-context";
import { api, signAndSubmit, type Prepared } from "@/lib/api";
import { fmtUsd } from "@/lib/split";
import { GIFT_EXPIRY_SECONDS } from "@/lib/config";
import { saveGiftLink } from "@/lib/local";

const PRESETS = [5, 10, 20, 50];

export default function NewGift() {
  const router = useRouter();
  const { wallet, loaded, balance, key, topUp, refreshBalance } = useWallet();
  const [amount, setAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const n = Number(amount);
  const valid = Number.isFinite(n) && n >= 0.5 && n <= 500;
  const short = balance != null && valid && balance < n;

  async function create() {
    if (!wallet || !valid) return;
    setError(null);
    setBusy("Confirm with your fingerprint…");
    try {
      const kp = await key();
      setBusy("Wrapping your gift…");
      // The link key: its secret goes ONLY into the link's #fragment (never to our server).
      const link = Keypair.random();
      const r = await api<{ id: string; prepared: Prepared }>("/api/gifts", {
        sender: wallet.pub,
        senderName: wallet.name,
        amount: n.toFixed(2),
        message,
        linkPub: link.publicKey(),
      });
      await signAndSubmit(r.prepared, kp);
      saveGiftLink(r.id, link.secret());
      refreshBalance();
      router.push(`/gift/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function addMoney() {
    setBusy("Adding test money…");
    setError(null);
    try {
      await topUp();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) return <AppShell><div /></AppShell>;
  if (!wallet)
    return (
      <AppShell>
        <div className="app-card slide-in">
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>Sign in to send a gift</div>
          <p style={{ margin: "10px 0 22px", color: "#3A4A3F", fontWeight: 500, fontSize: 16 }}>Takes 5 seconds. Just your fingerprint.</p>
          <SignInBlock />
        </div>
      </AppShell>
    );

  const hours = Math.round(GIFT_EXPIRY_SECONDS / 3600);
  const window = GIFT_EXPIRY_SECONDS >= 3600 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${Math.round(GIFT_EXPIRY_SECONDS / 60)} minutes`;

  return (
    <AppShell>
      <div className="app-card slide-in" style={{ background: "#FFD93D" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ padding: "6px 14px", borderRadius: 99, background: "#0B120D", color: "#FFD93D", fontWeight: 800, fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase" }}>
            Gbam Gift
          </span>
          <span className="wig" style={{ width: 44, height: 44, borderRadius: "50%", background: "#12E26B", border: "2px solid #0B120D", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <GiftIcon />
          </span>
        </div>

        <div className="label" style={{ marginTop: 22, color: "#1F2A22" }}>How much?</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginTop: 4 }}>
          <span style={{ fontSize: "clamp(48px,14vw,72px)", fontWeight: 800, letterSpacing: "-0.06em" }}>$</span>
          <input
            className="amount-input"
            inputMode="decimal"
            value={amount}
            aria-label="Amount in dollars"
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))}
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {PRESETS.map((p) => (
            <button key={p} className={`chip ${Number(amount) === p ? "on" : ""}`} onClick={() => setAmount(String(p))}>
              ${p}
            </button>
          ))}
        </div>

        <label style={{ display: "grid", gap: 8, marginTop: 22 }}>
          <span className="label" style={{ color: "#1F2A22" }}>Message (optional)</span>
          <textarea
            className="field"
            rows={2}
            maxLength={140}
            placeholder="For lunch. Do not spend it all on data."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, fontWeight: 700, fontSize: 14 }}>
          <span>You have {balance == null ? "…" : fmtUsd(balance)}</span>
          {short && (
            <button className="chip" onClick={addMoney} disabled={!!busy} style={{ background: "#fff" }}>
              + Add $25 test money
            </button>
          )}
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <ErrorBox error={error} />
          <button className="btn btn-green btn-block" disabled={!valid || short || !!busy} onClick={create}>
            {busy ? <><Spinner /> {busy}</> : <>Create link <ArrowIcon /></>}
          </button>
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1F2A22" }}>
            If nobody claims it within {window}, you can take it back.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
