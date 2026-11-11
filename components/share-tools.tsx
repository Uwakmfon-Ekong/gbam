"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { WhatsAppIcon } from "./ui";
import { whatsappUrl } from "@/lib/local";

/** Every way to hand over a link: WhatsApp, the phone's share sheet, copy, QR (for in-person), card image. */
export function ShareTools({ link, text, cardUrl, title = "Gbam" }: { link: string; text: string; cardUrl?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => setCanShare(typeof navigator !== "undefined" && !!navigator.share), []);
  useEffect(() => {
    if (!showQr || qr) return;
    QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0B120D", light: "#FFFFFF" } }).then(setQr);
  }, [showQr, qr, link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text, url: link });
    } catch {}
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <a className="btn btn-green btn-block" href={whatsappUrl(text)} target="_blank" rel="noreferrer">
        <WhatsAppIcon /> Share on WhatsApp
      </a>
      <div style={{ display: "grid", gridTemplateColumns: canShare ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8 }}>
        {canShare && <button className="btn btn-ghost btn-sm" onClick={nativeShare}>Share…</button>}
        <button className="btn btn-ghost btn-sm" onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>
        <button className={`btn btn-sm ${showQr ? "btn-ink" : "btn-ghost"}`} onClick={() => setShowQr((s) => !s)}>QR code</button>
      </div>
      {showQr && (
        <div className="slide-in" style={{ border: "2px solid #0B120D", borderRadius: 24, padding: 16, background: "#fff", display: "grid", justifyItems: "center", gap: 8 }}>
          {qr ? (
            <div style={{ width: "100%", maxWidth: 260 }} dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code for the link" />
          ) : (
            <div className="skel" style={{ width: 220, height: 220 }} />
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#3A4A3F", textAlign: "center" }}>Point their phone camera here. Great for in-person gifts.</div>
        </div>
      )}
      {cardUrl && (
        <a href={cardUrl} target="_blank" rel="noreferrer" style={{ textAlign: "center", fontSize: 13, fontWeight: 700, textDecoration: "underline", color: "#3A4A3F" }}>
          Open the gift card image (save it, then post it)
        </a>
      )}
    </div>
  );
}
