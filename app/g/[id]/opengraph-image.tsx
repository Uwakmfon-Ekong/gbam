import { ImageResponse } from "next/og";
import { get } from "@/lib/db";
import { fmtUsd } from "@/lib/split";
import type { Gift } from "@/lib/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A Gbam gift";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await get<Gift>("gift", id).catch(() => null);
  const amount = g ? fmtUsd(g.amount) : "A gift";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFD93D", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", border: "6px solid #0B120D", borderRadius: 48, background: "#fff", padding: 56, boxShadow: "16px 16px 0 #0B120D" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 44, fontWeight: 800 }}>
            <div style={{ width: 64, height: 64, borderRadius: 64, background: "#12E26B", border: "5px solid #0B120D", display: "flex" }} />
            Gbam
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: "#3A4A3F" }}>{g ? `${g.senderName} sent you` : "You got"}</div>
            <div style={{ fontSize: 200, fontWeight: 800, letterSpacing: -10, lineHeight: 1 }}>{amount}</div>
          </div>
          <div style={{ display: "flex", alignSelf: "flex-start", background: "#12E26B", border: "5px solid #0B120D", borderRadius: 999, padding: "16px 40px", fontSize: 40, fontWeight: 800 }}>
            Tap to claim
          </div>
        </div>
      </div>
    ),
    size,
  );
}
