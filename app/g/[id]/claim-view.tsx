"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Keypair } from "@stellar/stellar-sdk";
import { CheckIcon, Confetti, ErrorBox, FingerprintIcon, gbamFx, GiftIcon, Logo, Spinner } from "@/components/ui";
import { SignInBlock } from "@/components/signin-card";
import { useWallet } from "@/components/wallet-context";
import { api, signAndSubmit, type Prepared } from "@/lib/api";
import { usePoll } from "@/lib/hooks";
import { fmtUsd, usdToNgnLabel } from "@/lib/split";
import { EXPLORER_CONTRACT, EXPLORER_TX, NGN_PER_USD } from "@/lib/config";
import { signClaim } from "@/lib/soroban";
import type { Gift } from "@/lib/types";
import type { SavedWallet } from "@/lib/wallet";

function Shell({ children, bg = "#F7F9F4" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 32px" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <Logo size={22} />
      </div>
      <div style={{ width: "100%", maxWidth: 480 }}>{children}</div>
    </div>
  );
}

export default function ClaimView({ id }: { id: string }) {
  const { wallet, key, refreshBalance } = useWallet();
  const [linkKey, setLinkKey] = useState<Keypair | null | "bad">(null);
  const [phase, setPhase] = useState<"idle" | "signin" | "claiming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const { data, error: loadErr } = usePoll<{ gift: Gift; now: number }>(`/api/gifts/${id}`, 4000, phase !== "done");
  const gift = data?.gift;

  useEffect(() => {
    const s = decodeURIComponent(location.hash.slice(1));
    try {
      setLinkKey(s ? Keypair.fromSecret(s) : "bad");
    } catch {
      setLinkKey("bad");
    }
  }, []);

  const linkOk = linkKey && linkKey !== "bad" && gift && linkKey.publicKey() === gift.linkPub;

  async function claim(w: SavedWallet | null = wallet) {
    if (!w || !linkOk) return;
    setError(null);
    setPhase("claiming");
    try {
      const kp = await key();
      const lk = linkKey as Keypair;
      let res: { hash: string };
      if (gift!.mode === "contract") {
        // The link key signs "pay this gift to <my address>"; the escrow contract checks it on-chain.
        const sig = signClaim(lk, w.pub);
        const r = await api<{ prepared: Prepared }>(`/api/gifts/${id}/claim`, { receiver: w.pub, sig });
        res = await signAndSubmit<{ hash: string }>(r.prepared, kp);
      } else {
        const r = await api<{ prepared: Prepared }>(`/api/gifts/${id}/claim`, { receiver: w.pub });
        res = await signAndSubmit<{ hash: string }>(r.prepared, kp, lk);
      }
      setTx(res.hash);
      setPhase("done");
      gbamFx();
      refreshBalance();
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  }

  if (phase === "done" && gift)
    return (
      <Shell bg="#12E26B">
        <div style={{ position: "relative", minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", overflow: "hidden" }}>
          <Confetti />
          <div className="claimed-pop" style={{ width: 110, height: 110, borderRadius: "50%", background: "#0B120D", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckIcon size={60} color="#12E26B" />
          </div>
          <div className="claimed-pop" style={{ marginTop: 26, fontSize: 80, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.06em" }}>Gbam.</div>
          <div style={{ marginTop: 12, fontSize: 22, fontWeight: 700 }}>{fmtUsd(gift.amount)} is yours.</div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, opacity: 0.8 }}>
            About {usdToNgnLabel(gift.amount, NGN_PER_USD)}. It&apos;s safe in your Gbam, held as digital dollars.
          </div>
          {tx && (
            <a href={EXPLORER_TX(tx)} target="_blank" rel="noreferrer" style={{ marginTop: 10, fontSize: 13, fontWeight: 700, textDecoration: "underline" }}>
              Settled on Stellar in seconds
            </a>
          )}
          {gift.mode === "contract" && gift.contractId && (
            <a href={EXPLORER_CONTRACT(gift.contractId)} target="_blank" rel="noreferrer" style={{ marginTop: 4, fontSize: 13, fontWeight: 700, textDecoration: "underline" }}>
              Released by the Gbam escrow contract
            </a>
          )}
          <div style={{ display: "grid", gap: 10, marginTop: 34, width: "100%", maxWidth: 340 }}>
            <Link href="/gift/new" className="btn btn-ink btn-block">Send one back</Link>
            <Link href="/" className="btn btn-ghost btn-block">What is Gbam?</Link>
          </div>
        </div>
      </Shell>
    );

  if (loadErr && !gift)
    return (
      <Shell>
        <div className="app-card"><div style={{ fontSize: 28, fontWeight: 800 }}>Hmm.</div><p style={{ fontWeight: 600 }}>{loadErr}</p></div>
      </Shell>
    );

  if (!gift || linkKey === null)
    return (
      <Shell>
        <div className="app-card" style={{ display: "grid", placeItems: "center", minHeight: 360 }}><Spinner /></div>
      </Shell>
    );

  const expired = gift.status === "active" && Date.now() > gift.expiresAt;
  const blocked =
    gift.status === "claimed" ? "Someone already claimed this gift."
    : gift.status === "reclaimed" ? "The sender took this gift back."
    : expired ? "This gift expired. Ask the sender to send it again."
    : !linkOk ? "This link is incomplete. Ask the sender to share it again from Gbam."
    : null;

  return (
    <Shell>
      <div className="app-card slide-in">
        <div style={{ fontSize: 15, fontWeight: 700, color: "#5B6B60" }}>You got a gift</div>
        <div style={{ marginTop: 6, fontSize: "clamp(72px,22vw,96px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.06em" }}>{fmtUsd(gift.amount)}</div>
        <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>
          from {gift.senderName} <span style={{ color: "#5B6B60" }}>· ≈ {usdToNgnLabel(gift.amount, NGN_PER_USD)}</span>
        </div>

        {gift.message && (
          <div style={{ marginTop: 26, background: "#FFD93D", border: "2px solid #0B120D", borderRadius: 24, padding: 20, position: "relative" }}>
            <div className="label" style={{ color: "#0B120D" }}>Message</div>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{gift.message}</div>
            <div className="wig" style={{ position: "absolute", right: 14, top: -22, width: 44, height: 44, borderRadius: "50%", background: "#12E26B", border: "2px solid #0B120D", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GiftIcon />
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
          {blocked ? (
            <div className="warn">{blocked}</div>
          ) : phase === "signin" && !wallet ? (
            <div className="slide-in" style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>One quick step so the money has somewhere to land.</div>
              <SignInBlock cta="Claim with fingerprint" onDone={(w) => claim(w)} />
            </div>
          ) : (
            <>
              <ErrorBox error={error} />
              <button className="btn btn-green btn-block pulse" disabled={phase === "claiming"} onClick={() => (wallet ? claim() : setPhase("signin"))}>
                {phase === "claiming" ? <><Spinner /> Landing your money…</> : wallet ? <><FingerprintIcon /> Claim</> : "Claim"}
              </button>
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#5B6B60" }}>
                {wallet ? `Claiming as ${wallet.name}` : "Sign in with your fingerprint. That is it."}
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
