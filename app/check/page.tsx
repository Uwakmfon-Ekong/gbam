"use client";
import { AppShell, CheckIcon, Spinner } from "@/components/ui";
import { usePoll } from "@/lib/hooks";

type Check = { name: string; ok: boolean; warn?: boolean; detail: string; link?: string };

// Open this on the venue Wi-Fi before you pitch.
export default function CheckPage() {
  const { data, error, reload } = usePoll<{ ok: boolean; checks: Check[] }>("/api/health", 15000);
  return (
    <AppShell>
      <div className="app-card slide-in" style={{ maxWidth: 560 }}>
        <div className="label">Pre-demo check</div>
        <div style={{ marginTop: 6, fontSize: 44, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}>
          {!data ? "Checking…" : data.ok ? "Ready to Gbam." : "Fix these first."}
        </div>
        {error && <div className="err" style={{ marginTop: 16 }}>{error}</div>}
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          {!data && <div style={{ display: "grid", placeItems: "center", padding: 30 }}><Spinner /></div>}
          {data?.checks.map((c) => (
            <div key={c.name} style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "2px solid #0B120D", borderRadius: 18, padding: 14, background: !c.ok ? "#FFE3E0" : c.warn ? "#FFF6CC" : "#fff" }}>
              <span style={{ flex: "none", width: 26, height: 26, borderRadius: "50%", border: "2px solid #0B120D", background: !c.ok ? "#FF5A4E" : c.warn ? "#FFD93D" : "#12E26B", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>
                {c.ok && !c.warn ? <CheckIcon size={13} w={4} /> : c.ok ? "!" : "×"}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{c.name}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#3A4A3F", marginTop: 2, wordBreak: "break-word" }}>{c.detail}</div>
                {c.link && <a href={c.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, textDecoration: "underline" }}>View on Stellar Expert</a>}
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 18 }} onClick={reload}>Run again</button>
      </div>
    </AppShell>
  );
}
