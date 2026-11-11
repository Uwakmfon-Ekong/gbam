// Server-only data store. One table (`records`), JSON documents keyed by (kind, id).
// Without Supabase env vars it falls back to process memory — fine for `npm run dev`,
// NOT for Vercel (serverless instances don't share memory).
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Kind = "gift" | "split" | "share" | "profile";

type Row = { kind: Kind; id: string; data: Record<string, unknown> };

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;
function sb() {
  if (!url || !serviceKey) return null;
  if (!client) client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}

const g = globalThis as unknown as { __gbamMem?: Map<string, Row> };
const mem = (g.__gbamMem ||= new Map<string, Row>());
const mk = (kind: Kind, id: string) => `${kind}:${id}`;

export const usingMemoryStore = () => !sb();

export async function get<T>(kind: Kind, id: string): Promise<T | null> {
  const c = sb();
  if (!c) return (mem.get(mk(kind, id))?.data as T) ?? null;
  const { data, error } = await c.from("records").select("data").eq("kind", kind).eq("id", id).maybeSingle();
  if (error) throw new Error(`DB read failed: ${error.message}`);
  return (data?.data as T) ?? null;
}

export async function put<T extends object>(kind: Kind, id: string, data: T): Promise<T> {
  const c = sb();
  if (!c) {
    mem.set(mk(kind, id), { kind, id, data: data as Record<string, unknown> });
    return data;
  }
  const { error } = await c.from("records").upsert({ kind, id, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(`DB write failed: ${error.message}`);
  return data;
}

export async function patch<T extends object>(kind: Kind, id: string, changes: Partial<T>): Promise<T> {
  const cur = await get<T>(kind, id);
  if (!cur) throw new Error(`${kind} ${id} not found`);
  return put(kind, id, { ...cur, ...changes });
}

/** List records of a kind whose top-level `field` equals `value`. */
export async function listBy<T>(kind: Kind, field: string, value: string): Promise<T[]> {
  const c = sb();
  if (!c) {
    return [...mem.values()]
      .filter((r) => r.kind === kind && r.data[field] === value)
      .map((r) => r.data as T);
  }
  const { data, error } = await c
    .from("records")
    .select("data")
    .eq("kind", kind)
    .eq(`data->>${field}`, value)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`DB list failed: ${error.message}`);
  return (data || []).map((r) => r.data as T);
}

export function newId(len = 10) {
  const abc = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}
