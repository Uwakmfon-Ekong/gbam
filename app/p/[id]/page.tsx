import type { Metadata } from "next";
import { get } from "@/lib/db";
import { fmtNgn, fmtUsd } from "@/lib/split";
import type { Share } from "@/lib/types";
import PayView from "./pay-view";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await get<Share>("share", id).catch(() => null);
  if (!s) return { title: "Gbam" };
  const title = `${s.payerName} covered the bill. Your share: ${fmtNgn(s.amountNgn)}`;
  const description = `≈ ${fmtUsd(s.amountUsd)}${s.items.length ? ` for ${s.items.slice(0, 2).join(", ")}` : ""}. Pay back in one tap on Gbam.`;
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <PayView id={id} />;
}
