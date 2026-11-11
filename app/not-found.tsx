import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="app-card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 1 }}>No gbam.</div>
        <p style={{ fontSize: 17, fontWeight: 600, color: "#3A4A3F", margin: "14px 0 24px" }}>This link doesn&apos;t go anywhere. Ask whoever sent it to share it again.</p>
        <Link href="/" className="btn btn-green">Go home</Link>
      </div>
    </div>
  );
}
