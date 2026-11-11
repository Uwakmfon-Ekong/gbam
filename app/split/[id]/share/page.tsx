"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell, Avatar, CheckIcon, Confetti, ErrorBox, gbamFx, Spinner, WhatsAppIcon } from "@/components/ui";
import { usePoll } from "@/lib/hooks";
import { whatsappUrl } from "@/lib/local";
import { fmtNgn, fmtUsd } from "@/lib/split";
import type { Share, Split } from "@/lib/types";

export default function SplitStatus() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = usePoll<{ split: Split; shares: Share[] }>(`/api/splits/${id}`, 2000);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const prevPaid = useRef<number | null>(null);
  useEffect(() => setOrigin(location.origin), []);

  const shares = (data?.shares || []).slice().sort((a, b) => a.createdAt - b.createdAt);
  const paid = shares.filter((s) => s.status === "paid").length;
  const allPaid = shares.length > 0 && paid === shares.length;

  useEffect(() => {
    if (prevPaid.current != null && paid > prevPaid.current) gbamFx();
    prevPaid.current = paid;
  }, [paid]);

  if (error && !data) return <AppShell><div className="app-card"><ErrorBox error={error} /></div></AppShell>;
  if (!data) return <AppShell><div className="app-card" style={{ display: "grid", placeItems: "center", minHeight: 300 }}><Spinner /></div></AppShell>;

  const { split } = data;
  const collected = shares.filter((s) => s.status === "paid").reduce((a, s) => a + Number(s.amountUsd), 0);
  const due = shares.reduce((a, s) => a + Number(s.amountUsd), 0);

  const message = (s: Share) =>
    `Hey ${s.name} 👋 your share${split.merchant ? ` from ${split.merchant}` : ""} is ${fmtNgn(s.amountNgn)} (≈ ${fmtUsd(s.amountUsd)})` +
    `${s.items.length ? ` for ${s.items.slice(0, 3).join(", ")}${s.items.length > 3 ? "…" : ""}` : ""}.\n\nPay in one tap 👉 ${origin}/p/${s.id}`;

  async function copy(s: Share) {
    try {
      await navigator.clipboard.writeText(`${origin}/p/${s.id}`);
      setCopied(s.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  return (
    <AppShell>
      <div className="app-card slide-in" style={{ position: "relative", overflow: "hidden", background: allPaid ? "#12E26B" : "#fff" }}>
        {allPaid && <Confetti />}
        <div className="label" style={{ color: allPaid ? "#0B120D" : undefined }}>{split.merchant || "Your bill"}</div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span key={paid} className="claimed-pop" style={{ fontSize: "clamp(56px,16vw,80px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.06em" }}>
            {allPaid ? "Gbam." : `${paid} of ${shares.length}`}
          </span>
          {!allPaid && <span style={{ fontSize: 22, fontWeight: 800 }}>paid</span>}
        </div>
        <div style={{ marginTop: 8, fontWeight: 700, fontSize: 16 }}>
          {allPaid ? "Everyone paid you back." : `${fmtUsd(collected)} of ${fmtUsd(due)} back in your Gbam`}
        </div>
        <div className="bar" style={{ marginTop: 14, background: allPaid ? "#fff" : undefined }}>
          <span style={{ width: `${shares.length ? (paid / shares.length) * 100 : 0}%`, background: allPaid ? "#0B120D" : undefined }} />
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
          {shares.map((s) => (
            <div key={s.id} style={{ border: "2px solid #0B120D", borderRadius: 22, padding: 14, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={s.name} color={s.color} paid={s.status === "paid"} dashed={s.status !== "paid"} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{s.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#5B6B60", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.items.join(", ")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800 }}>{fmtNgn(s.amountNgn)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#5B6B60" }}>≈ {fmtUsd(s.amountUsd)}</div>
                </div>
              </div>
              {s.status === "paid" ? (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#0B120D" }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#12E26B", border: "2px solid #0B120D", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckIcon size={12} w={4} />
                  </span>
                  Paid
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <a className="btn btn-green btn-sm" style={{ flex: 1 }} href={whatsappUrl(message(s))} target="_blank" rel="noreferrer">
                    <WhatsAppIcon size={18} /> Send
                  </a>
                  <button className="btn btn-ghost btn-sm" onClick={() => copy(s)}>{copied === s.id ? "Copied ✓" : "Copy"}</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 18, fontSize: 13, fontWeight: 700, color: "#3A4A3F" }}>
          {!allPaid && <span className="dot-live" />}
          {allPaid ? <Link href="/split/new" style={{ textDecoration: "underline" }}>Split another bill</Link> : "Updates live as friends pay"}
        </div>
      </div>
    </AppShell>
  );
}
