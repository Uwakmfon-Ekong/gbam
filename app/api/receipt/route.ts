import { route, body } from "@/lib/route";
import { AppError } from "@/lib/stellar-server";
import { parseNaira } from "@/lib/split";

export const maxDuration = 60;

const PROMPT = `You read restaurant receipts from Nigeria. Return ONLY a JSON object, no prose, no code fences:
{
  "merchant": string,                 // restaurant name, "" if unknown
  "items": [ { "name": string, "qty": number, "price": number } ],  // price = LINE TOTAL for that row (qty × unit price), in naira
  "tax": number,                      // VAT / tax, 0 if none
  "service": number,                  // service charge, 0 if none
  "tip": number,                      // tip, 0 if none
  "total": number | null              // grand total printed on the receipt, null if not visible
}
Rules: numbers are plain numbers (4500 not "N4,500.00"). Do not put tax, service charge, discounts or totals in items.
Keep item names short and human ("Jollof rice and chicken"). If the image is not a receipt, return {"items": []}.`;

type Raw = { merchant?: string; items?: { name?: string; qty?: unknown; price?: unknown }[]; tax?: unknown; service?: unknown; tip?: unknown; total?: unknown };

export const POST = route(async (req) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AppError("AI reading isn't set up (missing ANTHROPIC_API_KEY). Use the demo receipt.", 503);
  const { image } = await body<{ image: string }>(req);
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(image || "");
  if (!m) throw new AppError("Send a photo of the receipt.");
  if (m[2].length > 5_000_000) throw new AppError("Photo too large. Try again.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error("Claude error", res.status, await res.text().catch(() => ""));
    throw new AppError("The AI couldn't read that one. Try again or use the demo receipt.", 502);
  }
  const data = await res.json();
  const text: string = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let raw: Raw;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new AppError("The AI's answer was garbled. Try again or use the demo receipt.", 502);
  }
  const items = (raw.items || [])
    .map((i) => ({ name: String(i.name || "Item").slice(0, 60), qty: Math.max(1, Math.round(Number(i.qty) || 1)), price: parseNaira(i.price) }))
    .filter((i) => i.price > 0);
  if (!items.length) throw new AppError("Couldn't find any items. Retake the photo closer, or use the demo receipt.", 422);
  const total = raw.total == null ? null : parseNaira(raw.total) || null;
  return {
    merchant: String(raw.merchant || "").slice(0, 60),
    items,
    tax: parseNaira(raw.tax),
    service: parseNaira(raw.service),
    tip: parseNaira(raw.tip),
    total,
  };
});
