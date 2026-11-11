import { AppError } from "./stellar-server";
import { clean } from "./route";
import { parseNaira, FRIEND_COLORS } from "./split";
import type { Charges, Friend, ReceiptItem } from "./types";
import { newId } from "./db";

export function sanitizeItems(v: unknown): ReceiptItem[] {
  if (!Array.isArray(v)) throw new AppError("Items missing");
  const items = v.slice(0, 60).map((i) => ({
    id: clean(i?.id, 20) || newId(6),
    name: clean(i?.name, 60) || "Item",
    qty: Math.max(1, Math.min(99, Math.round(Number(i?.qty) || 1))),
    price: Math.max(0, Math.round(parseNaira(i?.price) * 100) / 100),
  }));
  return items;
}

export function sanitizeCharges(v: unknown): Charges {
  const c = (v || {}) as Record<string, unknown>;
  return { tax: Math.max(0, parseNaira(c.tax)), service: Math.max(0, parseNaira(c.service)), tip: Math.max(0, parseNaira(c.tip)) };
}

export function sanitizeFriends(v: unknown): Friend[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 12).map((f, i) => ({
    id: clean(f?.id, 20) || newId(6),
    name: clean(f?.name, 24) || `Friend ${i + 1}`,
    color: /^#[0-9a-f]{6}$/i.test(f?.color) ? f.color : FRIEND_COLORS[i % FRIEND_COLORS.length],
    isPayer: !!f?.isPayer,
  }));
}

export function sanitizeAssign(v: unknown, items: ReceiptItem[], friends: Friend[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const fids = new Set(friends.map((f) => f.id));
  const a = (v || {}) as Record<string, unknown>;
  for (const it of items) {
    const arr = Array.isArray(a[it.id]) ? (a[it.id] as unknown[]) : [];
    out[it.id] = [...new Set(arr.filter((x): x is string => typeof x === "string" && fids.has(x)))];
  }
  return out;
}
