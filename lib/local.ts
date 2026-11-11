"use client";
// Sender-side memory. The gift link's secret is kept ONLY on the sender's device (and in the link itself).

const giftKey = (id: string) => `gbam.giftlink.${id}`;

export function saveGiftLink(id: string, secret: string) {
  localStorage.setItem(giftKey(id), secret);
}

export function giftLink(id: string): string | null {
  const s = localStorage.getItem(giftKey(id));
  return s ? `${location.origin}/g/${id}#${s}` : null;
}

export function rememberSplit(id: string, label: string) {
  const all = recentSplits().filter((s) => s.id !== id);
  all.unshift({ id, label, at: Date.now() });
  localStorage.setItem("gbam.splits", JSON.stringify(all.slice(0, 10)));
}

export function recentSplits(): { id: string; label: string; at: number }[] {
  try {
    return JSON.parse(localStorage.getItem("gbam.splits") || "[]");
  } catch {
    return [];
  }
}

export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
