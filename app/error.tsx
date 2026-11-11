"use client";
import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="app-card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}>Something slipped.</div>
        <p style={{ fontSize: 17, fontWeight: 600, color: "#3A4A3F", margin: "14px 0 24px" }}>Your money is safe. Try that again.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-green" onClick={reset}>Try again</button>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  );
}
