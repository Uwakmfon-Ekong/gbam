import type { Metadata } from "next";
import { get } from "@/lib/db";
import { fmtUsd } from "@/lib/split";
import type { Gift } from "@/lib/types";
import ClaimView from "./claim-view";

type Props = { params: Promise<{ id: string }> };

// WhatsApp's link preview reads these tags, so the receiver sees "You got $10" before opening.
// The link key lives in the #fragment, which crawlers (and our server) never receive.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const g = await get<Gift>("gift", id).catch(() => null);
  if (!g) return { title: "Gbam" };
  const title = `🎁 ${g.senderName} sent you ${fmtUsd(g.amount)}`;
  const description = g.message ? `"${g.message}" · Tap to claim on Gbam` : "Tap to claim. No app needed.";
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <ClaimView id={id} />;
}
