"use client";
import { useState } from "react";
import Link from "next/link";
import { Avatar, CheckIcon, Confetti, ErrorBox, FingerprintIcon, gbamFx, Logo, Spinner } from "@/components/ui";
import { SignInBlock } from "@/components/signin-card";
import { useWallet } from "@/components/wallet-context";
import { api, signAndSubmit, type Prepared } from "@/lib/api";
import { usePoll } from "@/lib/hooks";
import { fmtNgn, fmtUsd } from "@/lib/split";
import { EXPLORER_TX } from "@/lib/config";
import type { Share } from "@/lib/types";
import type { SavedWallet } from "@/lib/wallet";

function Shell({ children, bg = "#F7F9F4" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 32px" }}>
      <div style={{ marginBottom: 20 }}><Logo size={22} /></div>
      <div style={{ width: "100%", maxWidth: 480 }}>{children}</div>
    </div>
  );
}

export default function PayView({ id }: { id: string }) {
  const { wallet, key, balance, topUp, refreshBalance } = useWallet();
  const { data, error: loadErr } = usePoll<{ share: Share }>(`/api/shares/${id}`, 5000);
  const [phase, setPhase] = useState<"idle" | "signin" | "paying" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const share = data?.share;

  async function pay(w: SavedWallet | null = wallet) {
    if (!w || !share) return;
    setError(null);
    setPhase("paying");
    try {
      const kp = await key();
      const r = await api<{ prepared: Prepared }>(`/api/shares/${id}/pay`, { from: w.pub });
      const res = await signAndSubmit<{ hash: string }>(r.prepared, kp);
      setTx(res.hash);
      setPhase("done");
      gbamFx();
      refreshBalance();
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  async function addMoney() {
    setBusy(true);
    setError(null);
    try {
      await topUp();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadErr && !share) return <Shell><div className="app-card"><div style={{ fontSize: 28, fontWeight: 800 }}>Hmm.</div><p style={{ fontWeight: 600 }}>{loadErr}</p></div></Shell>;
  if (!share) return <Shell><div className="app-card" style={{ display: "grid", placeItems: "center", minHeight: 360 }}><Spinner /></div></Shell>;

  if (phase === "done" || (share.status === "paid" && wallet && share.paidBy === wallet.pub))
    return (
      <Shell bg="#12E26B">
        <div style={{ position: "relative", minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", overflow: "hidden" }}>
          {phase === "done" && <Confetti />}
          <div className="claimed-pop" style={{ width: 110, height: 110, borderRadius: "50%", background: "#0B120D", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={60} color="#12E26B" />
          </div>
          <div className="claimed-pop" style={{ marginTop: 26, fontSize: 80, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.06em" }}>Paid.</div>
          <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700 }}>{share.payerName} got your {fmtUsd(share.amountUsd)}. You&apos;re square.</div>
          {(tx || share.tx) && (
            <a href={EXPLORER_TX((tx || share.tx)!)} target="_blank" rel="noreferrer" style={{ marginTop: 10, fontSize: 13, fontWeight: 700, textDecoration: "underline" }}>Receipt on Stellar</a>
          )}
          <Link href="/" className="btn btn-ink" style={{ marginTop: 34 }}>What is Gbam?</Link>
        </div>
      </Shell>
    );

  const short = wallet && balance != null && balance < Number(share.amountUsd);

  return (
    <Shell>
      <div className="app-card slide-in">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={share.payerName} color="#12E26B" size={40} />
          <div style={{ fontSize: 15, fontWeight: 700, color: "#3A4A3F" }}>
            {share.payerName} covered the bill{share.merchant ? ` at ${share.merchant}` : ""}
          </div>
        </div>
        <div style={{ marginTop: 22, fontSize: 15, fontWeight: 700, color: "#5B6B60" }}>{share.name}, you owe</div>
        <div style={{ marginTop: 4, fontSize: "clamp(60px,18vw,84px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.06em" }}>{fmtNgn(share.amountNgn)}</div>
        <div style={{ marginTop: 6, fontSize: 17, fontWeight: 700 }}>≈ {fmtUsd(share.amountUsd)}</div>

        <div className="receipt" style={{ marginTop: 22 }}>
          <div className="label">For</div>
          {share.items.map((l, i) => (
            <div key={i} style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>{l}</div>
          ))}
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "#5B6B60" }}>Includes your share of tax and service.</div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          {share.status === "paid" ? (
            <div className="note">This share is already paid. 🎉</div>
          ) : phase === "signin" && !wallet ? (
            <div className="slide-in" style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Sign in to pay. 5 seconds.</div>
              <SignInBlock cta="Continue with fingerprint" onDone={() => setPhase("idle")} />
            </div>
          ) : short ? (
            <>
              <div className="warn">You have {fmtUsd(balance!)} in Gbam. Top up to pay.</div>
              <ErrorBox error={error} />
              <button className="btn btn-yellow btn-block" onClick={addMoney} disabled={busy}>
                {busy ? <><Spinner /> Adding…</> : "+ Add $25 test money"}
              </button>
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#5B6B60" }}>In the real app this is a bank transfer or card top-up in naira.</div>
            </>
          ) : (
            <>
              <ErrorBox error={error} />
              <button className="btn btn-green btn-block pulse" disabled={phase === "paying"} onClick={() => (wallet ? pay() : setPhase("signin"))}>
                {phase === "paying" ? <><Spinner /> Paying…</> : <><FingerprintIcon /> Pay {fmtUsd(share.amountUsd)}</>}
              </button>
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#5B6B60" }}>
                {wallet ? `Paying as ${wallet.name} · no fees` : "No app to download. No fees."}
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
