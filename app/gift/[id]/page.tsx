"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell, CheckIcon, Confetti, ErrorBox, gbamFx, Spinner, WhatsAppIcon } from "@/components/ui";
import { useWallet } from "@/components/wallet-context";
import { fmtCountdown, useNow, usePoll } from "@/lib/hooks";
import { giftLink, whatsappUrl } from "@/lib/local";
import { api, signAndSubmit, type Prepared } from "@/lib/api";
import { fmtUsd } from "@/lib/split";
import { EXPLORER_CONTRACT, EXPLORER_TX } from "@/lib/config";
import type { Gift } from "@/lib/types";

export default function GiftStatus() {
  const { id } = useParams<{ id: string }>();
  const { wallet, key, refreshBalance } = useWallet();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, error: loadErr, reload } = usePoll<{ gift: Gift; now: number }>(`/api/gifts/${id}`, 2000);
  const gift = data?.gift;
  const now = useNow();
  const celebrated = useRef(false);

  useEffect(() => setLink(giftLink(id)), [id]);
  useEffect(() => {
    if (gift?.status === "claimed" && !celebrated.current) {
      celebrated.current = true;
      gbamFx();
    }
  }, [gift?.status]);

  if (loadErr && !gift) return <AppShell><div className="app-card"><ErrorBox error={loadErr} /></div></AppShell>;
  if (!gift) return <AppShell><div className="app-card" style={{ display: "grid", placeItems: "center", minHeight: 300 }}><Spinner /></div></AppShell>;

  const isSender = wallet?.pub === gift.sender;
  const expired = gift.status === "active" && now >= gift.expiresAt;
  const shareText = `🎁 ${gift.senderName} sent you ${fmtUsd(gift.amount)} on Gbam!${gift.message ? `\n"${gift.message}"` : ""}\n\nTap to claim 👉 ${link}`;

  async function takeBack() {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      const kp = await key();
      const r = await api<{ prepared: Prepared }>(`/api/gifts/${id}/reclaim`, { sender: wallet.pub });
      await signAndSubmit(r.prepared, kp);
      await reload();
      refreshBalance();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  if (gift.status === "claimed")
    return (
      <AppShell>
        <div className="app-card slide-in" style={{ position: "relative", overflow: "hidden", background: "#12E26B", textAlign: "center", padding: "48px 28px" }}>
          <Confetti />
          <div className="claimed-pop" style={{ width: 96, height: 96, borderRadius: "50%", background: "#0B120D", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
            <CheckIcon size={52} color="#12E26B" />
          </div>
          <div className="claimed-pop" style={{ marginTop: 22, fontSize: 64, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.06em" }}>Claimed.</div>
          <div style={{ marginTop: 12, fontSize: 19, fontWeight: 700 }}>Your {fmtUsd(gift.amount)} gift landed.</div>
          {gift.claimTx && (
            <a href={EXPLORER_TX(gift.claimTx)} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 700, textDecoration: "underline" }}>
              See it on Stellar
            </a>
          )}
          <div style={{ display: "grid", gap: 10, marginTop: 28 }}>
            <Link href="/gift/new" className="btn btn-ink btn-block">Send another</Link>
          </div>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="app-card slide-in">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span className="pill">
            <span className={`dot-live ${gift.status === "active" && !expired ? "dot-wait" : ""}`} />
            {gift.status === "reclaimed" ? "Taken back" : expired ? "Not claimed in time" : "Waiting for them to claim"}
          </span>
        </div>
        <div style={{ marginTop: 20, fontSize: "clamp(64px,18vw,88px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.06em" }}>{fmtUsd(gift.amount)}</div>
        {gift.message && <div style={{ marginTop: 8, fontSize: 17, fontWeight: 700, color: "#3A4A3F" }}>&ldquo;{gift.message}&rdquo;</div>}

        {gift.status === "reclaimed" ? (
          <div className="note" style={{ marginTop: 22 }}>
            {fmtUsd(gift.amount)} is back in your Gbam. The old link no longer works.
          </div>
        ) : expired ? (
          <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
            <div className="warn">Nobody claimed it. The money is still yours. Take it back anytime.</div>
            <ErrorBox error={error} />
            {isSender && (
              <button className="btn btn-yellow btn-block" onClick={takeBack} disabled={busy}>
                {busy ? <><Spinner /> Taking it back…</> : "Take it back"}
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
            {link ? (
              <>
                <a className="btn btn-green btn-block" href={whatsappUrl(shareText)} target="_blank" rel="noreferrer">
                  <WhatsAppIcon /> Share on WhatsApp
                </a>
                <button className="btn btn-ghost btn-block" onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#5B6B60", lineHeight: 1.45, textAlign: "center" }}>
                  Anyone with this link can claim it, like cash. Only send it to the person it&apos;s for.
                </div>
              </>
            ) : (
              <div className="note">The link lives on the phone that created it. Open this page there to share it.</div>
            )}
            <div className="receipt" style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
              <span>Take-back unlocks in</span>
              <span>{fmtCountdown(gift.expiresAt - now)}</span>
            </div>
          </div>
        )}
        {gift.createTx && (
          <a href={EXPLORER_TX(gift.createTx)} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 18, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#5B6B60", textDecoration: "underline" }}>
            {gift.mode === "contract" ? "Locked in the Gbam escrow contract. View transaction" : "Locked on Stellar. View transaction"}
          </a>
        )}
        {gift.mode === "contract" && gift.contractId && (
          <a href={EXPLORER_CONTRACT(gift.contractId)} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#5B6B60", textDecoration: "underline" }}>
            See the contract
          </a>
        )}
      </div>
    </AppShell>
  );
}
