"use client";
import { useState } from "react";
import Link from "next/link";
import { AppShell, ArrowIcon, CheckIcon } from "@/components/ui";
import { SignInBlock } from "@/components/signin-card";
import { useWallet } from "@/components/wallet-context";
import { fmtNgn, fmtUsd } from "@/lib/split";
import { NGN_PER_USD } from "@/lib/config";

// Bank names are just choices in a list. On mainnet, the anchor supplies the supported banks.
const BANKS = ["Access Bank", "First Bank", "GTBank", "Kuda", "Moniepoint", "OPay", "PalmPay", "UBA", "Zenith Bank"];

/**
 * Cash out to a Nigerian bank account — PREVIEW.
 * On mainnet this hands off to a licensed Stellar anchor using SEP-24 (hosted withdrawal):
 *   SEP-10 sign-in with the user's key → anchor's hosted form (KYC, bank) → user sends USDC to the anchor → anchor pays naira.
 * On testnet nothing here moves money; the screen says so.
 */
export default function CashOut() {
  const { wallet, loaded, balance } = useWallet();
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [acct, setAcct] = useState("");
  const [open, setOpen] = useState(false);

  const bal = balance ?? 0;
  const n = amount === "" ? bal : Number(amount);
  const valid = Number.isFinite(n) && n > 0 && n <= bal && bank && /^\d{10}$/.test(acct);
  const ngn = Math.round((Number.isFinite(n) ? n : 0) * NGN_PER_USD);

  if (!loaded) return <AppShell><div /></AppShell>;
  if (!wallet)
    return (
      <AppShell>
        <div className="app-card slide-in">
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em" }}>Sign in to cash out</div>
          <p style={{ margin: "10px 0 22px", color: "#3A4A3F", fontWeight: 500 }}>Use the same fingerprint you claimed with.</p>
          <SignInBlock />
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="app-card slide-in" style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ padding: "6px 14px", borderRadius: 99, background: "#0B120D", color: "#12E26B", fontWeight: 800, fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase" }}>
            Cash out to bank
          </span>
          <span className="pill" style={{ padding: "4px 12px", fontSize: 12, background: "#FFD93D" }}>Preview · coming next</span>
        </div>

        <div className="label" style={{ marginTop: 22 }}>You have</div>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1.05 }}>{balance == null ? "…" : fmtUsd(bal)}</div>
        <div style={{ fontWeight: 700, color: "#5B6B60" }}>≈ {fmtNgn(Math.round(bal * NGN_PER_USD))}</div>

        <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span className="label">How much</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="field"
                inputMode="decimal"
                placeholder={bal ? bal.toFixed(2) : "0.00"}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))}
                aria-label="Amount in dollars"
              />
              <button className="chip" style={{ height: 56, flex: "none" }} onClick={() => setAmount("")}>All</button>
            </div>
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span className="label">Bank</span>
            <select className="field" value={bank} onChange={(e) => setBank(e.target.value)} style={{ appearance: "auto" }}>
              <option value="">Choose your bank</option>
              {BANKS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span className="label">Account number</span>
            <input
              className="field"
              inputMode="numeric"
              placeholder="10 digits"
              value={acct}
              onChange={(e) => setAcct(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </label>

          <div className="receipt" style={{ display: "grid", gap: 8 }}>
            <Row label="You send" value={`${fmtUsd(Number.isFinite(n) ? n : 0)} USDC`} />
            <Row label="Rate" value={`${fmtNgn(NGN_PER_USD)} = $1 (demo rate)`} />
            <Row label="Partner fee" value="Quoted by the anchor" muted />
            <div style={{ borderTop: "2px dashed #0B120D", paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 20 }}>
              <span>Into your bank</span>
              <span>≈ {fmtNgn(ngn)}</span>
            </div>
          </div>

          <button className="btn btn-green btn-block" disabled={!valid} onClick={() => setOpen(true)}>
            Cash out {fmtNgn(ngn)} <ArrowIcon />
          </button>
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#5B6B60", lineHeight: 1.45 }}>
            Powered by licensed Stellar anchors using SEP-24. Name check and ID happen with the partner.
          </div>
        </div>

        {open && (
          <div className="slide-in" style={{ position: "absolute", inset: 0, background: "rgba(247,249,244,.97)", borderRadius: 30, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <span className="pill" style={{ alignSelf: "flex-start", background: "#FFD93D", fontSize: 13 }}>Preview · no money moved</span>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>Here&apos;s what happens on mainnet</div>
            {[
              ["Sign in with the anchor", "Your fingerprint signs a Stellar login (SEP-10). No new password."],
              ["Confirm with the partner", `They verify you and ${bank || "your bank"} account ••${acct.slice(-4) || "0000"}.`],
              ["USDC goes to the anchor", `${fmtUsd(Number.isFinite(n) ? n : 0)} moves on Stellar in seconds.`],
              ["Naira lands in your bank", `≈ ${fmtNgn(ngn)} by bank transfer, usually within minutes.`],
            ].map(([t, d], i) => (
              <div key={t} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ flex: "none", width: 34, height: 34, borderRadius: "50%", background: i === 3 ? "#12E26B" : "#fff", border: "2px solid #0B120D", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                  {i === 3 ? <CheckIcon size={16} w={3.6} /> : i + 1}
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{t}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#3A4A3F", lineHeight: 1.4 }}>{d}</div>
                </div>
              </div>
            ))}
            <div className="note" style={{ marginTop: "auto" }}>
              This build runs on Stellar testnet with demo money, so there&apos;s nothing to cash out yet. Anchor integration is our next step.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setOpen(false)}>Back</button>
              <Link href="/gift/new" className="btn btn-green btn-sm" style={{ flex: 1 }}>Send a gift</Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 700, fontSize: 15, color: muted ? "#5B6B60" : undefined }}>
      <span>{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}