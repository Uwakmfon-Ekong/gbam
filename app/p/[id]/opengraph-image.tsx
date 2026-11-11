import { ImageResponse } from "next/og";
import { get } from "@/lib/db";
import { fmtUsd } from "@/lib/split";
import type { Share } from "@/lib/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Your share of the bill";

// What WhatsApp shows before a friend opens their pay link.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await get<Share>("share", id).catch(() => null);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0B120D", padding: 48, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", border: "6px solid #12E26B", borderRadius: 48, background: "#fff", padding: "44px 56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 44, fontWeight: 800 }}>
            <div style={{ width: 64, height: 64, borderRadius: 64, background: "#12E26B", border: "5px solid #0B120D", display: "flex" }} />
            Gbam Split
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#3A4A3F" }}>{s ? `${s.payerName} covered the bill. Your share:` : "Your share"}</div>
            <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: -4, lineHeight: 1.1 }}>{s ? `NGN ${Math.round(s.amountNgn).toLocaleString("en-US")}` : "Tap to pay"}</div>
            {s && <div style={{ fontSize: 40, fontWeight: 700 }}>{`≈ ${fmtUsd(s.amountUsd)}`}</div>}
          </div>
          <div style={{ display: "flex", alignSelf: "flex-start", background: "#12E26B", border: "5px solid #0B120D", borderRadius: 999, height: 84, padding: "0 40px", alignItems: "center", fontSize: 38, fontWeight: 800 }}>
            Pay in one tap
          </div>
        </div>
      </div>
    ),
    size,
  );
}
