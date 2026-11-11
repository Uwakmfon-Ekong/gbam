"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, ArrowIcon, Avatar, ErrorBox, Spinner } from "@/components/ui";
import { useWallet } from "@/components/wallet-context";
import { api } from "@/lib/api";
import { chargesTotal, computeShares, fmtNgn, fmtUsd, FRIEND_COLORS, grandTotal, itemsTotal, mathMismatch, parseNaira } from "@/lib/split";
import type { Charges, Friend, ReceiptItem, Split } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 8);

export default function ReviewAssign() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { wallet } = useWallet();
  const [split, setSplit] = useState<Split | null>(null);
  const [active, setActive] = useState<string>("me");
  const [editing, setEditing] = useState<string | null>(null);
  const [newFriend, setNewFriend] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    api<{ split: Split }>(`/api/splits/${id}`)
      .then(({ split }) => {
        if (split.status === "sent") router.replace(`/split/${id}/share`);
        else setSplit(split);
      })
      .catch((e) => setError(e.message));
  }, [id, router]);

  // Autosave edits (debounced) so a refresh never loses work.
  useEffect(() => {
    if (!split || !dirty.current || !wallet) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await api(`/api/splits/${id}`, { ...split, payer: wallet.pub });
        dirty.current = false;
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [split, id, wallet]);

  const update = (fn: (s: Split) => Split) => {
    dirty.current = true;
    setSplit((s) => (s ? fn(s) : s));
  };

  const calc = useMemo(() => (split ? computeShares(split) : null), [split]);

  if (error && !split) return <AppShell><div className="app-card"><ErrorBox error={error} /></div></AppShell>;
  if (!split || !calc) return <AppShell><div className="app-card" style={{ display: "grid", placeItems: "center", minHeight: 300 }}><Spinner /></div></AppShell>;
  if (wallet && wallet.pub !== split.payer)
    return <AppShell><div className="app-card"><div className="warn">Only the person who paid can edit this bill.</div></div></AppShell>;

  const friendsById = Object.fromEntries(split.friends.map((f) => [f.id, f]));
  const mismatch = mathMismatch(split.items, split.charges, split.receiptTotal);
  const others = split.friends.filter((f) => !f.isPayer);
  const owedTotal = calc.shares.filter((s) => !s.friend.isPayer).reduce((a, s) => a + s.totalNgn, 0);

  const toggle = (itemId: string) =>
    update((s) => {
      const cur = s.assign[itemId] || [];
      const next = cur.includes(active) ? cur.filter((x) => x !== active) : [...cur, active];
      return { ...s, assign: { ...s.assign, [itemId]: next } };
    });

  const setItem = (itemId: string, patch: Partial<ReceiptItem>) =>
    update((s) => ({ ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));

  const addItem = () => {
    const nid = uid();
    update((s) => ({ ...s, items: [...s.items, { id: nid, name: "New item", qty: 1, price: 0 }] }));
    setEditing(nid);
  };

  const removeItem = (itemId: string) =>
    update((s) => {
      const assign = { ...s.assign };
      delete assign[itemId];
      return { ...s, items: s.items.filter((i) => i.id !== itemId), assign };
    });

  const setCharge = (k: keyof Charges, v: string) => update((s) => ({ ...s, charges: { ...s.charges, [k]: parseNaira(v) } }));

  const addFriend = () => {
    const name = newFriend.trim();
    if (!name) return;
    const f: Friend = { id: uid(), name: name.slice(0, 24), color: FRIEND_COLORS[(split.friends.length - 1) % (FRIEND_COLORS.length - 1)] };
    update((s) => ({ ...s, friends: [...s.friends, f] }));
    setActive(f.id);
    setNewFriend("");
  };

  const removeFriend = (fid: string) => {
    update((s) => ({
      ...s,
      friends: s.friends.filter((f) => f.id !== fid),
      assign: Object.fromEntries(Object.entries(s.assign).map(([k, v]) => [k, v.filter((x) => x !== fid)])),
    }));
    if (active === fid) setActive("me");
  };

  const leftoversToEveryone = () =>
    update((s) => {
      const all = s.friends.map((f) => f.id);
      const assign = { ...s.assign };
      for (const it of s.items) if (!(assign[it.id] || []).length) assign[it.id] = all;
      return { ...s, assign };
    });

  async function send() {
    if (!wallet) return;
    setError(null);
    setSending(true);
    try {
      await api(`/api/splits/${id}`, { ...split, payer: wallet.pub });
      await api(`/api/splits/${id}/send`, { payer: wallet.pub });
      router.push(`/split/${id}/share`);
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }

  const activeFriend = friendsById[active];

  return (
    <AppShell wide>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div className="label">Step 2 of 3</div>
          <h1 style={{ margin: "6px 0 0", fontSize: "clamp(30px,6vw,48px)", lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 800 }}>Who had what?</h1>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#5B6B60" }}>{saving ? "Saving…" : "Saved"}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        {/* ── Friends (first on phones so you pick a person, then tap items) ── */}
        <div className="split-friends">
          <div className="card" style={{ background: "#fff", padding: 22 }}>
            <div className="label">Pick a person</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {calc.shares.map((s) => {
                const on = s.friend.id === active;
                return (
                  <div
                    key={s.friend.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActive(s.friend.id)}
                    onKeyDown={(e) => e.key === "Enter" && setActive(s.friend.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 18, border: "2px solid #0B120D", background: on ? "#0B120D" : "#fff", color: on ? "#fff" : "#0B120D", cursor: "pointer" }}
                  >
                    <Avatar name={s.friend.name} color={s.friend.color} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.friend.isPayer ? `${s.friend.name} (you paid)` : s.friend.name}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.75 }}>
                        {s.labels.length ? `${s.labels.length} item${s.labels.length > 1 ? "s" : ""}` : "Nothing yet"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800 }}>{fmtNgn(s.totalNgn)}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>≈ {fmtUsd(s.usd)}</div>
                    </div>
                    {!s.friend.isPayer && (
                      <button
                        aria-label={`Remove ${s.friend.name}`}
                        onClick={(e) => (e.stopPropagation(), removeFriend(s.friend.id))}
                        style={{ background: "none", border: "none", color: "inherit", fontSize: 20, cursor: "pointer", padding: 4, opacity: 0.6 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <form onSubmit={(e) => (e.preventDefault(), addFriend())} style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input className="field" style={{ height: 48 }} placeholder="Add a friend's name" value={newFriend} onChange={(e) => setNewFriend(e.target.value)} />
              <button className="btn btn-green btn-sm" type="submit" disabled={!newFriend.trim()}>Add</button>
            </form>
            <div style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: "#5B6B60", lineHeight: 1.45 }}>
              Tax and service are shared by what each person ordered. Rate: {fmtNgn(split.rate)} = $1 (demo rate).
            </div>
          </div>
        </div>

        {/* ── Receipt ── */}
        <div className="split-receipt">
          <div className="card" style={{ background: "#fff", padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="label">Tap what {activeFriend?.isPayer ? "you" : activeFriend?.name || "they"} had</div>
              <button className="chip" onClick={leftoversToEveryone} style={{ height: 34, fontSize: 13 }}>Share the rest with everyone</button>
            </div>
            <input
              className="field"
              style={{ marginTop: 14, height: 46, fontSize: 16 }}
              value={split.merchant}
              placeholder="Restaurant name"
              onChange={(e) => update((s) => ({ ...s, merchant: e.target.value }))}
            />
            <div className="receipt" style={{ marginTop: 14, padding: 10 }}>
              {split.items.map((it) => {
                const who = split.assign[it.id] || [];
                const mine = who.includes(active);
                if (editing === it.id)
                  return (
                    <div key={it.id} className="slide-in" style={{ display: "grid", gridTemplateColumns: "1fr 60px 110px", gap: 6, padding: 8, borderRadius: 14, background: "#fff", border: "2px solid #0B120D", margin: "6px 0" }}>
                      <input className="field" style={{ height: 42, fontSize: 15, padding: "0 10px" }} value={it.name} aria-label="Item name" onChange={(e) => setItem(it.id, { name: e.target.value })} autoFocus />
                      <input className="field" style={{ height: 42, fontSize: 15, padding: "0 8px" }} inputMode="numeric" value={it.qty} aria-label="Quantity" onChange={(e) => setItem(it.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })} />
                      <input className="field" style={{ height: 42, fontSize: 15, padding: "0 8px" }} inputMode="decimal" value={it.price || ""} placeholder="₦" aria-label="Line total in naira" onChange={(e) => setItem(it.id, { price: parseNaira(e.target.value) })} />
                      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
                        <button className="chip" style={{ height: 34, fontSize: 13 }} onClick={() => removeItem(it.id)}>Delete</button>
                        <button className="chip on" style={{ height: 34, fontSize: 13 }} onClick={() => setEditing(null)}>Done</button>
                      </div>
                    </div>
                  );
                return (
                  <div
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(it.id)}
                    onKeyDown={(e) => e.key === "Enter" && toggle(it.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 14, cursor: "pointer", background: mine ? "#C9F5DA" : "transparent", border: `2px solid ${mine ? "#0B120D" : "transparent"}`, margin: "2px 0", transition: "background .15s" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {it.qty > 1 && <span style={{ color: "#5B6B60" }}>{it.qty}× </span>}
                        {it.name}
                      </div>
                      <div style={{ display: "flex", gap: 2, marginTop: who.length ? 6 : 0 }}>
                        {who.map((fid) => friendsById[fid] && <Avatar key={fid} name={friendsById[fid].name} color={friendsById[fid].color} size={22} />)}
                        {!who.length && <span style={{ fontSize: 12, fontWeight: 700, color: "#C0392B" }}>Not assigned</span>}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800 }}>{fmtNgn(it.price)}</div>
                    <button
                      aria-label={`Edit ${it.name}`}
                      onClick={(e) => (e.stopPropagation(), setEditing(it.id))}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B120D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
                    </button>
                  </div>
                );
              })}
              <button className="chip" onClick={addItem} style={{ margin: "8px 6px", height: 34, fontSize: 13 }}>+ Add item</button>

              <div style={{ borderTop: "2px dashed #0B120D", marginTop: 8, padding: "12px 6px 4px", display: "grid", gap: 8 }}>
                <Row label="Items" value={fmtNgn(itemsTotal(split.items))} />
                {(["tax", "service", "tip"] as const).map((k) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
                    <span>{k === "tax" ? "VAT / tax" : k === "service" ? "Service charge" : "Tip"}</span>
                    <input
                      className="field"
                      style={{ width: 120, height: 38, fontSize: 15, textAlign: "right", padding: "0 10px" }}
                      inputMode="decimal"
                      value={split.charges[k] || ""}
                      placeholder="₦0"
                      aria-label={k}
                      onChange={(e) => setCharge(k, e.target.value)}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, borderTop: "2px dashed #0B120D", paddingTop: 10 }}>
                  <span>Total</span>
                  <span>{fmtNgn(grandTotal(split.items, split.charges))}</span>
                </div>
              </div>
            </div>
            {mismatch && (
              <div className="warn" style={{ marginTop: 12 }}>
                Check these numbers: the receipt says {fmtNgn(mismatch.receipt)} but the lines add up to {fmtNgn(mismatch.ours)}. Tap the pencil to fix a line.
              </div>
            )}
            {chargesTotal(split.charges) === 0 && split.items.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "#5B6B60" }}>No tax or service charge found. Add them above if the bill had any.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Send bar ── */}
      <div style={{ position: "sticky", bottom: 12, marginTop: 24, zIndex: 5 }}>
        <div style={{ background: "#0B120D", color: "#fff", borderRadius: 28, border: "2px solid #0B120D", padding: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", boxShadow: "6px 6px 0 #12E26B" }}>
          <div style={{ flex: "1 1 200px", paddingLeft: 8 }}>
            {calc.unassigned.length ? (
              <div style={{ fontWeight: 800, color: "#FFD93D" }}>{calc.unassigned.length} item{calc.unassigned.length > 1 ? "s" : ""} not assigned yet</div>
            ) : others.length === 0 ? (
              <div style={{ fontWeight: 800, color: "#FFD93D" }}>Add the friends who ate with you</div>
            ) : (
              <div style={{ fontWeight: 800 }}>
                Friends owe you {fmtNgn(owedTotal)} <span style={{ color: "#12E26B" }}>≈ {fmtUsd(calc.shares.filter((s) => !s.friend.isPayer).reduce((a, s) => a + s.usd, 0))}</span>
              </div>
            )}
            <ErrorBox error={error} />
          </div>
          <button className="btn btn-green btn-green-on-dark" disabled={sending || !!calc.unassigned.length || !others.length} onClick={send} style={{ flex: "1 1 220px" }}>
            {sending ? <><Spinner /> Making links…</> : <>Create payment links <ArrowIcon /></>}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
