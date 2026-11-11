"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, ErrorBox, Spinner } from "@/components/ui";
import { SignInBlock } from "@/components/signin-card";
import { useWallet } from "@/components/wallet-context";
import { api } from "@/lib/api";
import { shrinkImage } from "@/lib/image";
import { DEMO_RECEIPT } from "@/lib/split";
import { rememberSplit } from "@/lib/local";

type Parsed = { merchant: string; items: { name: string; qty: number; price: number }[]; tax: number; service: number; tip: number; total: number | null };

export default function ScanBill() {
  const router = useRouter();
  const { wallet, loaded } = useWallet();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(p: Parsed) {
    if (!wallet) return;
    setBusy("Setting up your bill…");
    const { id } = await api<{ id: string }>("/api/splits", {
      payer: wallet.pub,
      payerName: wallet.name,
      merchant: p.merchant,
      items: p.items,
      charges: { tax: p.tax, service: p.service, tip: p.tip },
      receiptTotal: p.total,
    });
    rememberSplit(id, p.merchant || "Bill");
    router.push(`/split/${id}`);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      setBusy("Preparing photo…");
      const img = await shrinkImage(f);
      setPreview(img);
      setBusy("Reading your bill…");
      const parsed = await api<Parsed>("/api/receipt", { image: img });
      await start(parsed);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function demo() {
    setError(null);
    try {
      await start({ ...DEMO_RECEIPT, tip: 0 });
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  if (!loaded) return <AppShell><div /></AppShell>;
  if (!wallet)
    return (
      <AppShell>
        <div className="app-card slide-in">
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>Sign in to split a bill</div>
          <p style={{ margin: "10px 0 22px", color: "#3A4A3F", fontWeight: 500, fontSize: 16 }}>Your friends pay you back straight into your Gbam.</p>
          <SignInBlock />
        </div>
      </AppShell>
    );

  const reading = busy === "Reading your bill…";

  return (
    <AppShell>
      <div className="app-card slide-in" style={{ background: "#0B120D", color: "#fff", boxShadow: "8px 8px 0 #12E26B" }}>
        <span style={{ padding: "6px 14px", borderRadius: 99, background: "#12E26B", color: "#0B120D", fontWeight: 800, fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase" }}>
          Gbam Split
        </span>
        <h1 style={{ margin: "18px 0 0", fontSize: "clamp(32px,8vw,44px)", lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 800 }}>
          Snap the bill.
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.5, color: "#C7D3CA", fontWeight: 500 }}>
          AI reads every item. You fix anything it got wrong. Each friend gets their own link.
        </p>

        <div style={{ marginTop: 22, background: "#fff", color: "#0B120D", borderRadius: 22, padding: 18, minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {reading ? (
            <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Your receipt" style={{ width: 88, borderRadius: 12, border: "2px solid #0B120D", objectFit: "cover" }} />
              )}
              <div style={{ flex: 1 }}>
                <div className="label">Reading your bill</div>
                <div className="skel" style={{ marginTop: 14, width: "90%" }} />
                <div className="skel" style={{ marginTop: 10, width: "70%" }} />
                <div className="skel" style={{ marginTop: 10, width: "80%" }} />
                <div className="skel" style={{ marginTop: 10, width: "55%" }} />
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
              style={{ border: "2px dashed #0B120D", borderRadius: 18, background: "#FBFCF8", padding: "28px 16px", font: "inherit", cursor: "pointer", display: "grid", placeItems: "center", gap: 8 }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0B120D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              <span style={{ fontWeight: 800, fontSize: 18 }}>{busy || "Take a photo of the bill"}</span>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#5B6B60" }}>opens your camera</span>
            </button>
          )}
          {!reading && (
            <button className="chip" disabled={!!busy} onClick={() => galleryRef.current?.click()} style={{ marginTop: 12, justifySelf: "center", alignSelf: "center" }}>
              Upload from gallery
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <ErrorBox error={error} />
          <button className="btn btn-ink btn-block" disabled={!!busy} onClick={demo}>
            {busy && !reading ? <><Spinner /> {busy}</> : "Try demo receipt"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
