import type { Charges, Friend, ReceiptItem, Split } from "./types";

/** "N4,500.00" / "₦ 4 500" / "NGN4500" / 4500 → 4500 */
export function parseNaira(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const cleaned = v.replace(/ngn|naira|₦|n(?=\s*\d)/gi, "").replace(/[,\s]/g, "").replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export const itemsTotal = (items: ReceiptItem[]) => r2(items.reduce((s, i) => s + (Number(i.price) || 0), 0));
export const chargesTotal = (c: Charges) => r2((c.tax || 0) + (c.service || 0) + (c.tip || 0));
export const grandTotal = (items: ReceiptItem[], c: Charges) => r2(itemsTotal(items) + chargesTotal(c));

/** Receipt says X but the lines add up to Y → show "Check these numbers". Tolerates ₦1 rounding. */
export function mathMismatch(items: ReceiptItem[], c: Charges, receiptTotal: number | null) {
  if (receiptTotal == null || !receiptTotal) return null;
  const ours = grandTotal(items, c);
  const diff = r2(receiptTotal - ours);
  return Math.abs(diff) > 1 ? { ours, receipt: receiptTotal, diff } : null;
}

export const toUsd = (ngn: number, rate: number) => {
  if (ngn <= 0) return 0;
  return Math.max(0.01, Math.round((ngn / rate) * 100) / 100);
};

const FRACTION: Record<number, string> = { 2: "½", 3: "⅓", 4: "¼", 5: "⅕", 6: "⅙", 8: "⅛" };

export type ShareCalc = {
  friend: Friend;
  subtotal: number;
  extras: number;
  totalNgn: number;
  usd: number;
  labels: string[];
};

/**
 * Each item is split evenly between the friends assigned to it.
 * Tax, service charge and tip are shared in proportion to what each friend ordered.
 */
export function computeShares(split: Pick<Split, "items" | "charges" | "friends" | "assign" | "rate">): {
  shares: ShareCalc[];
  unassigned: ReceiptItem[];
} {
  const { items, charges, friends, assign, rate } = split;
  const sub: Record<string, number> = {};
  const labels: Record<string, string[]> = {};
  friends.forEach((f) => ((sub[f.id] = 0), (labels[f.id] = [])));
  const unassigned: ReceiptItem[] = [];

  for (const item of items) {
    const who = (assign[item.id] || []).filter((id) => id in sub);
    if (!who.length) {
      if (item.price > 0) unassigned.push(item);
      continue;
    }
    const each = item.price / who.length;
    const base = item.qty > 1 ? `${item.qty}× ${item.name}` : item.name;
    for (const id of who) {
      sub[id] += each;
      labels[id].push(who.length > 1 ? `${FRACTION[who.length] || `1/${who.length}`} ${base}` : base);
    }
  }

  const assignedTotal = Object.values(sub).reduce((a, b) => a + b, 0);
  const extrasPool = chargesTotal(charges);
  const shares = friends.map((friend) => {
    const subtotal = r2(sub[friend.id]);
    const extras = assignedTotal > 0 ? r2((sub[friend.id] / assignedTotal) * extrasPool) : 0;
    const totalNgn = r2(subtotal + extras);
    return { friend, subtotal, extras, totalNgn, usd: toUsd(totalNgn, rate), labels: labels[friend.id] };
  });
  return { shares, unassigned };
}

export const fmtNgn = (n: number) =>
  "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
export const fmtUsd = (n: number | string) => {
  const v = typeof n === "string" ? Number(n) : n;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const FRIEND_COLORS = ["#FFD93D", "#C9F5DA", "#FFC2D4", "#B9D7FF", "#FFB27A", "#D9C2FF", "#12E26B"];

/** Clean demo receipt — loads instantly if the AI or the network fails on stage. */
export const DEMO_RECEIPT = {
  merchant: "Mama Ekaette's Kitchen, Uyo",
  items: [
    { name: "Jollof rice and chicken", qty: 1, price: 4500 },
    { name: "Afang soup with eba", qty: 1, price: 5200 },
    { name: "Suya platter", qty: 1, price: 6000 },
    { name: "Peppered snail", qty: 1, price: 3800 },
    { name: "Chapman", qty: 2, price: 3000 },
    { name: "Bottled water", qty: 3, price: 900 },
  ],
  tax: 1755,
  service: 1170,
  total: 26325,
};
