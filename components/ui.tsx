"use client";
import Link from "next/link";
import { useState } from "react";
import { useWallet } from "./wallet-context";
import { fmtUsd, usdToNgnLabel } from "@/lib/split";
import { NGN_PER_USD } from "@/lib/config";

export const CheckIcon = ({ size = 18, color = "#0B120D", w = 3 }: { size?: number; color?: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const ArrowIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const GiftIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#0B120D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="8" width="18" height="13" rx="2" />
    <path d="M12 8v13M3 12h18M12 8c-2-4-6-3-5 0 .6 1.7 3.4 1.4 5 0zm0 0c2-4 6-3 5 0-.6 1.7-3.4 1.4-5 0z" />
  </svg>
);
export const FingerprintIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 11v4M8 11a4 4 0 0 1 8 0M6 8a8 8 0 0 1 12 0M5 20c.5-3 1-5 1-9M19 20c-.5-3-1-5-1-9M9 20c.3-2 .5-3.5.5-5M15 20c-.3-2-.5-3.5-.5-5" />
  </svg>
);
export const WhatsAppIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-1-1.1-1.3-1.7-.1-.2 0-.4.1-.5l.4-.5.3-.4v-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.6.6-.9 1.3-.9 2.1 0 .9.4 1.8.9 2.5 1.1 1.6 2.5 2.9 4.3 3.6 1.5.6 2.2.6 3 .5.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2z" />
  </svg>
);

export function Spinner() {
  return <span className="spin" aria-label="Loading" />;
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: size, letterSpacing: "-0.04em" }}>
      <span style={{ width: size + 8, height: size + 8, borderRadius: "50%", background: "#12E26B", border: "2px solid #0B120D", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <CheckIcon size={size * 0.7} w={3.2} />
      </span>
      Gbam
    </Link>
  );
}

export function Confetti({ count = 12 }: { count?: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <span key={i} className="conf" />)}
    </div>
  );
}

export function Avatar({ name, color, paid, dashed, size = 46 }: { name: string; color: string; paid?: boolean; dashed?: boolean; size?: number }) {
  return (
    <span
      className="avatar"
      title={name}
      style={{ background: dashed ? "#fff" : color, borderStyle: dashed ? "dashed" : "solid", width: size, height: size, color: dashed ? "#5B6B60" : "#0B120D", fontSize: size * 0.38 }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
      {paid && (
        <span className="tick">
          <CheckIcon size={11} w={4} />
        </span>
      )}
    </span>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="err slide-in" role="alert">{error}</div>;
}

/** Plays a short "gbam!" thud + buzz. No audio files needed. */
export function gbamFx() {
  try {
    navigator.vibrate?.([30, 40, 80]);
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const now = ctx.currentTime;
    const note = (freq: number, start: number, dur: number, type: OscillatorType = "triangle", vol = 0.25) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now + start);
      g.gain.setValueAtTime(vol, now + start);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(now + start);
      o.stop(now + start + dur);
    };
    note(110, 0, 0.25, "sine", 0.5); // the "gb-"
    note(784, 0.08, 0.18); // the "-am!"
    note(1175, 0.16, 0.35);
  } catch {}
}

export function AppShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const { wallet, balance, signOut, topUp } = useWallet();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="wrap" style={{ width: "100%", paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 10px 10px 18px", border: "2px solid #0B120D", borderRadius: 999, background: "#fff", position: "relative" }}>
          <Logo size={22} />
          {wallet ? (
            <button className="chip" onClick={() => setMenu((m) => !m)} style={{ display: "flex", alignItems: "center", gap: 8, height: 42 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#FFD93D", border: "2px solid #0B120D", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                {wallet.name.charAt(0).toUpperCase()}
              </span>
              {balance == null ? "…" : fmtUsd(balance)}
            </button>
          ) : (
            <Link href="/signin" className="btn btn-green btn-sm">Sign in</Link>
          )}
          {menu && wallet && (
            <div className="slide-in" style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", zIndex: 20, width: 280, background: "#fff", border: "2px solid #0B120D", borderRadius: 24, padding: 16, boxShadow: "6px 6px 0 #0B120D" }}>
              <div className="label">Signed in as</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{wallet.name}</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.04em", marginTop: 10 }}>{balance == null ? "…" : fmtUsd(balance)}</div>
              {balance != null && <div style={{ fontSize: 13, fontWeight: 700, color: "#5B6B60" }}>≈ {usdToNgnLabel(balance, NGN_PER_USD)}</div>}
              <div style={{ fontSize: 13, color: "#5B6B60", fontWeight: 600, marginTop: 8 }}>
                {wallet.mode === "passkey" ? "🔐 Secured by your passkey" : "📱 Saved on this device only"}
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                <Link href="/gift/new" className="btn btn-green btn-sm" onClick={() => setMenu(false)}>Send a Gift</Link>
                <Link href="/split/new" className="btn btn-ghost btn-sm" onClick={() => setMenu(false)}>Split a Bill</Link>
                <button
                  className="btn btn-yellow btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try { await topUp(); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
                  }}
                >
                  {busy ? <Spinner /> : "+ Add $25 test money"}
                </button>
                <Link href="/cashout" className="btn btn-ghost btn-sm" onClick={() => setMenu(false)} style={{ borderStyle: "dashed" }}>
                  Cash out to bank (₦) <span style={{ fontSize: 11, background: "#FFD93D", border: "1.5px solid #0B120D", borderRadius: 99, padding: "1px 7px" }}>preview</span>
                </Link>
                <button
                  className="chip"
                  onClick={() => {
                    if (wallet.mode === "device" && !confirm("This Gbam is saved only on this device. Signing out loses it. Continue?")) return;
                    signOut();
                    setMenu(false);
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <main className="wrap" style={{ width: "100%", flex: 1, paddingTop: 40, paddingBottom: 40, maxWidth: wide ? 1100 : 1200 }}>
        {children}
      </main>
      <div className="wrap" style={{ width: "100%", paddingBottom: 24, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#5B6B60" }}>
        Gbam runs on Stellar testnet. Test money only. · <Link href="/check" style={{ textDecoration: "underline" }}>Status</Link>
      </div>
    </div>
  );
}