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

/** Which AI reads receipts: Claude if ANTHROPIC_API_KEY is set, otherwise Gemini (free tier) if GEMINI_API_KEY is set. */
function receiptProvider(): "claude" | "gemini" | null {
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

async function askClaude(mime: string, data: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data } }, { type: "text", text: PROMPT }] }],
    }),
  });
  if (!res.ok) {
    console.error("Claude error", res.status, await res.text().catch(() => ""));
    throw new AppError("The AI couldn't read that one. Try again or use the demo receipt.", 502);
  }
  const out = await res.json();
  return (out.content || []).map((c: { text?: string }) => c.text || "").join("");
}

async function askGemini(mime: string, data: string): Promise<string> {
  // Try the configured model first, then fall back to other free-tier vision models.
  const models = [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"].filter(Boolean) as string[];
  let last = "";
  for (const model of [...new Set(models)]) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime, data } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
    if (res.ok) {
      const out = await res.json();
      return (out.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("");
    }
    last = `${res.status} ${await res.text().catch(() => "")}`.slice(0, 300);
    console.error("Gemini error", model, last);
    if (res.status === 429) throw new AppError("Free AI limit reached for now. Wait a minute or use the demo receipt.", 429);
    if (res.status !== 404 && res.status !== 400) break; // only try another model if this one doesn't exist
  }
  throw new AppError("The AI couldn't read that one. Try again or use the demo receipt.", 502);
}

export const POST = route(async (req) => {
  const provider = receiptProvider();
  if (!provider) throw new AppError("AI reading isn't set up (add a GEMINI_API_KEY or ANTHROPIC_API_KEY). Use the demo receipt.", 503);
  const { image } = await body<{ image: string }>(req);
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(image || "");
  if (!m) throw new AppError("Send a photo of the receipt.");
  if (m[2].length > 5_000_000) throw new AppError("Photo too large. Try again.");

  const text = provider === "claude" ? await askClaude(m[1], m[2]) : await askGemini(m[1], m[2]);
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