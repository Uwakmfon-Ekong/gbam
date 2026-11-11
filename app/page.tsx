"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowIcon, CheckIcon, Confetti, GiftIcon, Logo } from "@/components/ui";
import { useWallet } from "@/components/wallet-context";
import { api } from "@/lib/api";
import { recentSplits } from "@/lib/local";
import { fmtUsd } from "@/lib/split";
import type { Gift } from "@/lib/types";

const MARQUEE = ["No wallet", "No seed phrase", "No fees", "Just a link", "Gift it", "Split it", "Done"];

export default function Home() {
  return (
    <div className="land" style={{ width: "100%", overflowX: "clip" }}>
      <Nav />
      <Hero />
      <Marquees />
      <Activity />
      <How />
      <Features />
      <Why />
      <FinalCta />
      <div className="wrap" style={{ paddingBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", paddingTop: 20, borderTop: "2px solid #0B120D", fontWeight: 700, fontSize: 15, color: "#3A4A3F" }}>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.04em", color: "#0B120D" }}>Gbam</span>
          <span>Built on Stellar for Boundless Build Day, Uyo. 12 Nov 2026.</span>
        </div>
      </div>
    </div>
  );
}

function Nav() {
  const { wallet, balance } = useWallet();
  return (
    <div className="wrap" style={{ paddingTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "12px 12px 12px 22px", border: "2px solid #0B120D", borderRadius: 999, background: "#fff" }}>
        <Logo />
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", fontWeight: 700, fontSize: 15 }}>
          <a href="#how">How it works</a>
          <a href="#features">Gift and Split</a>
          <a href="#faq">Why it works</a>
          {wallet && balance != null && <span className="pill" style={{ padding: "6px 14px" }}>{fmtUsd(balance)}</span>}
          <Link href="/gift/new" className="btn btn-green" style={{ height: 44, padding: "0 22px", fontSize: 15 }}>Send a Gift</Link>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const [tab, setTab] = useState<"gift" | "split">("gift");
  const [claimed, setClaimed] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      if (!touched && tab === "gift") setClaimed((c) => !c);
    }, 3200);
    return () => clearInterval(t);
  }, [touched, tab]);

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <div className="hero-bg" aria-hidden="true">
        <div className="dots" />
        {Array.from({ length: 8 }, (_, i) => <span key={i} className="coin">$</span>)}
      </div>
      <div className="wrap" id="top" style={{ position: "relative", zIndex: 1, paddingTop: 56, paddingBottom: 72 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 480px", minWidth: 0 }}>
            <div className="hero-in d1"><span className="pill"><span className="dot-live" />Built on Stellar for Boundless Build Day</span></div>
            <h1 style={{ margin: "24px 0 0", fontSize: "clamp(44px,7.4vw,96px)", lineHeight: 0.98, letterSpacing: "-0.05em", fontWeight: 800 }}>
              <span className="w w1">Send</span> <span className="w w2">money</span> <span className="w w3">like</span> <span className="w w4">a</span>{" "}
              <span className="w w5">WhatsApp</span> <span className="w w6">message.</span> <span className="w w7"><span className="hl">Gbam.</span></span>
            </h1>
            <p className="hero-in d3" style={{ margin: "28px 0 0", fontSize: "clamp(18px,2vw,22px)", lineHeight: 1.5, maxWidth: 520, color: "#3A4A3F", fontWeight: 500 }}>
              Send money to anyone, even if they have never used crypto. Share a link. They tap. It lands.
            </p>
            <div className="hero-in d4 hero-btns" style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 36 }}>
              <Link href="/gift/new" className="btn btn-green pulse">Send a Gift <ArrowIcon /></Link>
              <Link href="/split/new" className="btn btn-ghost">Split a Bill</Link>
            </div>
            <div className="hero-in d4" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 32, fontWeight: 700, fontSize: 15, color: "#3A4A3F" }}>
              <span style={{ display: "inline-flex" }}>
                {[["T", "#FFD93D", "#0B120D"], ["A", "#12E26B", "#0B120D"], ["C", "#0B120D", "#12E26B"]].map(([l, bg, c], i) => (
                  <span key={l} style={{ width: 34, height: 34, borderRadius: "50%", background: bg, color: c, border: "2px solid #0B120D", marginLeft: i ? -10 : 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{l}</span>
                ))}
              </span>
              No app to download. No setup. Just WhatsApp.
            </div>
          </div>

          <div style={{ position: "relative", flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <div className="ring-box" aria-hidden="true" style={{ position: "absolute", left: "50%", top: 300, width: 820, height: 820, marginLeft: -410, marginTop: -410, pointerEvents: "none", zIndex: 0 }}>
              <span className="ring" /><span className="ring" /><span className="ring" /><span className="ring" />
            </div>
            <div style={{ position: "relative", zIndex: 1, width: 310, maxWidth: "100%" }}>
              <Sticker cls="float stk-l1" r={-6} style={{ left: -46, top: 70, background: "#FFD93D" }}>$10 sent</Sticker>
              <Sticker cls="float2 stk-r" r={5} style={{ right: -40, top: 250, background: "#fff", display: "flex", alignItems: "center", gap: 8 }}><CheckIcon /> Claimed</Sticker>
              <Sticker cls="float3 stk-l2" r={-4} style={{ left: -30, bottom: 90, background: "#12E26B" }}>3 of 5 paid</Sticker>
              <div style={{ width: "100%", border: "3px solid #0B120D", borderRadius: 48, background: "#0B120D", padding: 10, boxShadow: "10px 10px 0 #12E26B" }}>
                <div style={{ position: "relative", height: 590, borderRadius: 38, background: "#fff", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}><span style={{ width: 90, height: 22, borderRadius: 99, background: "#0B120D" }} /></div>
                  {tab === "split" ? <PhoneSplit /> : claimed ? (
                    <PhoneClaimed onAgain={() => (setTouched(true), setClaimed(false))} />
                  ) : (
                    <PhoneGift onClaim={() => (setTouched(true), setClaimed(true))} />
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className={`tabbtn ${tab === "gift" ? "on" : ""}`} onClick={() => (setTab("gift"), setClaimed(false), setTouched(true))}>Gift</button>
              <button className={`tabbtn ${tab === "split" ? "on" : ""}`} onClick={() => (setTab("split"), setTouched(true))}>Split</button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#5B6B60", textAlign: "center" }}>Tap around. Or <Link href="/gift/new" style={{ textDecoration: "underline" }}>send a real one</Link>.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sticker({ children, cls, r, style }: { children: React.ReactNode; cls: string; r: number; style: React.CSSProperties }) {
  return (
    <div className={cls} style={{ ["--r" as string]: `${r}deg`, position: "absolute", zIndex: 3, border: "2px solid #0B120D", borderRadius: 18, padding: "10px 16px", fontWeight: 800, fontSize: 15, boxShadow: "4px 4px 0 #0B120D", transform: `rotate(${r}deg)`, ...style }}>
      {children}
    </div>
  );
}

function PhoneGift({ onClaim }: { onClaim: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 22px 26px" }}>
      <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em" }}>Gbam</div>
      <div style={{ marginTop: 22, fontSize: 15, fontWeight: 700, color: "#5B6B60" }}>You got a gift</div>
      <div style={{ marginTop: 6, fontSize: 76, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.06em" }}>$10</div>
      <div style={{ marginTop: 8, fontSize: 17, fontWeight: 700 }}>from a friend</div>
      <div style={{ marginTop: 22, background: "#FFD93D", border: "2px solid #0B120D", borderRadius: 24, padding: 20, position: "relative" }}>
        <div className="label" style={{ color: "#0B120D" }}>Message</div>
        <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>For lunch. Do not spend it all on data.</div>
        <div className="wig" style={{ position: "absolute", right: 14, top: -22, width: 44, height: 44, borderRadius: "50%", background: "#12E26B", border: "2px solid #0B120D", display: "flex", alignItems: "center", justifyContent: "center" }}><GiftIcon /></div>
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn btn-green" style={{ width: "100%" }} onClick={onClaim}>Claim</button>
      <div style={{ marginTop: 12, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#5B6B60" }}>Sign in with your fingerprint. That is it.</div>
    </div>
  );
}

function PhoneClaimed({ onAgain }: { onAgain: () => void }) {
  return (
    <div style={{ position: "relative", flex: 1, background: "#12E26B", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, overflow: "hidden" }}>
      <Confetti count={10} />
      <div className="claimed-pop" style={{ width: 96, height: 96, borderRadius: "50%", background: "#0B120D", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckIcon size={52} color="#12E26B" /></div>
      <div className="claimed-pop" style={{ marginTop: 26, fontSize: 64, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.06em" }}>Gbam.</div>
      <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700 }}>$10 is yours.</div>
      <button className="btn btn-ink" style={{ marginTop: 34, height: 48, fontSize: 15 }} onClick={onAgain}>Run it back</button>
    </div>
  );
}

function PhoneSplit() {
  const people: [string, string, boolean][] = [["T", "#FFD93D", true], ["A", "#C9F5DA", true], ["C", "#FFC2D4", true], ["D", "#fff", false], ["E", "#fff", false]];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "22px 22px 26px" }}>
      <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em" }}>Gbam Split</div>
      <div className="receipt" style={{ marginTop: 18 }}>
        <div className="label">Receipt</div>
        {[["Jollof rice and chicken", "₦4,500"], ["Suya platter", "₦6,000"], ["Chapman x2", "₦3,000"]].map(([n, p]) => (
          <div key={n} style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}><span>{n}</span><span>{p}</span></div>
        ))}
        <div style={{ marginTop: 12, borderTop: "2px dashed #0B120D", paddingTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 17 }}><span>Total</span><span>₦13,500</span></div>
      </div>
      <div style={{ marginTop: 20, fontWeight: 800, fontSize: 16 }}>3 of 5 paid</div>
      <div className="bar" style={{ marginTop: 10 }}><span style={{ width: "60%" }} /></div>
      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {people.map(([l, c, paid]) => (
          <span key={l} className="avatar" style={{ background: c, borderStyle: paid ? "solid" : "dashed", color: paid ? "#0B120D" : "#5B6B60" }}>
            {l}
            {paid && <span className="tick"><CheckIcon size={11} w={4} /></span>}
          </span>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 56, borderRadius: 999, background: "#0B120D", color: "#12E26B", fontWeight: 800, fontSize: 16 }}>Nudge the last two</div>
    </div>
  );
}

function Marquees() {
  const items = [...MARQUEE, ...MARQUEE];
  const row = items.map((t, i) => (
    <span key={i} style={{ display: "inline-flex", alignItems: "center" }}><span className="marq-item">{t}</span><span className="marq-dot" /></span>
  ));
  return (
    <>
      <div style={{ background: "#0B120D", color: "#fff", padding: "22px 0", borderTop: "2px solid #0B120D", borderBottom: "2px solid #0B120D", overflow: "hidden", transform: "rotate(-1.2deg)", margin: "0 -20px", position: "relative", zIndex: 2 }}>
        <div className="marq" aria-hidden="true">{row}</div>
      </div>
      <div className="band2" style={{ background: "#12E26B", color: "#0B120D", padding: "22px 0", borderTop: "2px solid #0B120D", borderBottom: "2px solid #0B120D", overflow: "hidden", transform: "rotate(1.4deg)", margin: "-52px -20px 0", position: "relative", zIndex: 1 }}>
        <div className="marq marq-rev" aria-hidden="true">{row}</div>
      </div>
    </>
  );
}

/** "Recent activity" from the PRD. Only shows once you've used Gbam on this device. */
function Activity() {
  const { wallet } = useWallet();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [splits, setSplits] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    if (!wallet) return;
    setSplits(recentSplits().slice(0, 4));
    api<{ gifts: Gift[] }>(`/api/gifts?sender=${wallet.pub}`).then((r) => setGifts(r.gifts.slice(0, 4))).catch(() => {});
  }, [wallet]);
  if (!wallet || (!gifts.length && !splits.length)) return null;
  const label = (g: Gift) => (g.status === "claimed" ? "Claimed" : g.status === "reclaimed" ? "Taken back" : Date.now() > g.expiresAt ? "Take it back" : "Waiting");
  return (
    <div className="wrap" style={{ paddingTop: 110 }}>
      <span className="pill">Your activity</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 20 }}>
        {gifts.map((g) => (
          <Link key={g.id} href={`/gift/${g.id}`} className="card card-hover" style={{ background: g.status === "claimed" ? "#12E26B" : "#FFD93D", padding: 18, borderRadius: 24 }}>
            <div className="label" style={{ color: "#0B120D" }}>Gift · {label(g)}</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.05em" }}>{fmtUsd(g.amount)}</div>
            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.message || "No message"}</div>
          </Link>
        ))}
        {splits.map((s) => (
          <Link key={s.id} href={`/split/${s.id}`} className="card card-hover card-dark" style={{ background: "#0B120D", color: "#fff", padding: 18, borderRadius: 24 }}>
            <div className="label" style={{ color: "#12E26B" }}>Split</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 6 }}>{s.label}</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#C7D3CA", marginTop: 4 }}>See who has paid →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function How() {
  const steps = [
    { n: "01", t: "Make it", d: "Pick an amount. Add a short message if you feel like it. Gbam makes you a link.", bg: "#fff", color: "#12E26B", stroke: "#0B120D" },
    { n: "02", t: "Share it", d: "One tap opens WhatsApp. Send the link like you would send a meme. They see what they got before they even open it.", bg: "#FFD93D", color: "#fff", stroke: "#0B120D" },
    { n: "03", t: "Gbam.", d: "They tap Claim, confirm with a fingerprint, and the money is theirs. You see Claimed on your screen. Nobody claims it in 24 hours? Take it back.", bg: "#0B120D", color: "#0B120D", stroke: "#12E26B", dark: true },
  ];
  return (
    <div className="wrap" id="how" style={{ paddingTop: 150 }}>
      <div className="reveal">
        <span className="pill">How it works</span>
        <h2 style={{ margin: "20px 0 0", fontSize: "clamp(36px,5.6vw,68px)", lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 800, maxWidth: 760 }}>Three taps. Zero stress.</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24, marginTop: 48 }}>
        {steps.map((s) => (
          <div key={s.n} className={`card card-hover reveal ${s.dark ? "card-dark" : ""}`} style={{ background: s.bg, color: s.dark ? "#fff" : undefined, padding: 32, display: "flex", flexDirection: "column", gap: 14, minHeight: 300 }}>
            <div style={{ fontSize: 88, lineHeight: 0.9, fontWeight: 800, letterSpacing: "-0.07em", color: s.color, WebkitTextStroke: `2px ${s.stroke}` }}>{s.n}</div>
            <h3 style={{ margin: "8px 0 0", fontSize: 28, letterSpacing: "-0.03em", fontWeight: 800, color: s.dark ? "#12E26B" : undefined }}>{s.t}</h3>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: s.dark ? "#C7D3CA" : "#3A4A3F", fontWeight: 500 }}>{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Features() {
  return (
    <div className="wrap" id="features" style={{ paddingTop: 120 }}>
      <div className="reveal">
        <span className="pill">Two ways to Gbam</span>
        <h2 style={{ margin: "20px 0 0", fontSize: "clamp(36px,5.6vw,68px)", lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 800, maxWidth: 820 }}>Gift it. Or split it.</h2>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 48 }}>
        <div className="card card-hover reveal" style={{ flex: "1 1 520px", minWidth: 0, background: "#FFD93D", padding: 36, display: "flex", flexDirection: "column", gap: 20, overflow: "hidden" }}>
          <span style={{ alignSelf: "flex-start", padding: "6px 14px", borderRadius: 99, background: "#0B120D", color: "#FFD93D", fontWeight: 800, fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase" }}>Gbam Gift</span>
          <h3 style={{ margin: 0, fontSize: "clamp(30px,4vw,48px)", lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 800 }}>Send money to someone who has never touched crypto.</h3>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55, fontWeight: 600, color: "#1F2A22", maxWidth: 460 }}>They do not need to download anything or learn anything first. They open your link, sign in with a fingerprint, and claim it.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["Claim in one tap", "Add a message", "24-hour take back"].map((t) => <span key={t} className="pill">{t}</span>)}
          </div>
          <Link href="/gift/new" className="btn btn-ink" style={{ alignSelf: "flex-start" }}>Send a Gift <ArrowIcon /></Link>
        </div>
        <div className="card card-hover card-dark reveal" style={{ flex: "1 1 520px", minWidth: 0, background: "#0B120D", color: "#fff", padding: 36, display: "flex", flexDirection: "column", gap: 20, overflow: "hidden" }}>
          <span style={{ alignSelf: "flex-start", padding: "6px 14px", borderRadius: 99, background: "#12E26B", color: "#0B120D", fontWeight: 800, fontSize: 13, letterSpacing: ".06em", textTransform: "uppercase" }}>Gbam Split</span>
          <h3 style={{ margin: 0, fontSize: "clamp(30px,4vw,48px)", lineHeight: 1.02, letterSpacing: "-0.04em", fontWeight: 800 }}>Snap the bill. Stop chasing your friends.</h3>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55, fontWeight: 500, color: "#C7D3CA", maxWidth: 460 }}>Take a photo of the receipt. AI reads every item, you fix anything it got wrong, and each friend gets their own link with exactly what they owe.</p>
          <div style={{ background: "#fff", color: "#0B120D", borderRadius: 20, padding: 22, maxWidth: 360 }}>
            <div className="label">Reading your bill</div>
            <div className="skel" style={{ marginTop: 14, width: "90%" }} />
            <div className="skel" style={{ marginTop: 10, width: "70%" }} />
            <div style={{ marginTop: 20, borderTop: "2px dashed #0B120D", paddingTop: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#5B6B60" }}>You owe</div>
              <div style={{ fontSize: 48, lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.05em" }}>₦6,300</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>≈ $4.20 for rice and chicken</div>
            </div>
          </div>
          <Link href="/split/new" className="btn btn-green btn-green-on-dark" style={{ alignSelf: "flex-start" }}>Split a Bill <ArrowIcon /></Link>
        </div>
        <div className="card reveal" style={{ flex: "1 1 100%", minWidth: 0, background: "#12E26B", padding: "44px 36px", display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, flex: "1 1 420px", fontSize: "clamp(34px,5.4vw,64px)", lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 800 }}>
            No <span className="strike">wallet</span>. No <span className="strike">seed phrase</span>. No <span className="strike">fees</span>.
          </h3>
          <p style={{ margin: 0, flex: "1 1 320px", fontSize: 19, lineHeight: 1.5, fontWeight: 700, maxWidth: 420 }}>Sign in with a fingerprint and everything is set up for you. You just see Gift, Pay and Done.</p>
        </div>
      </div>
    </div>
  );
}

function Why() {
  const items = [
    { t: "It is just a link", d: "If they can open WhatsApp, they can get paid.", bg: "#12E26B", icon: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /> },
    { t: "Sign in with a fingerprint", d: "Your passkey is your wallet. Nothing to write down, nothing to forget, and it follows you to a new phone.", bg: "#FFD93D", icon: <path d="M12 11v4M8 11a4 4 0 0 1 8 0M6 8a8 8 0 0 1 12 0M5 20c.5-3 1-5 1-9M19 20c-.5-3-1-5-1-9M9 20c.3-2 .5-3.5.5-5M15 20c-.3-2-.5-3.5-.5-5" /> },
    { t: "Lands in seconds", d: "Built on Stellar, so payments settle fast and you never see a fee.", bg: "#C9F5DA", icon: <path d="M13 3L5 14h6l-1 7 8-11h-6z" /> },
    { t: "Take it back", d: "Changed your mind? If nobody claims your gift within 24 hours, you can take it back. Stellar enforces it, not us.", bg: "#FFC2D4", icon: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" /> },
  ];
  return (
    <div className="wrap" id="faq" style={{ paddingTop: 120 }}>
      <div className="reveal">
        <span className="pill">Why Gbam</span>
        <h2 style={{ margin: "20px 0 0", fontSize: "clamp(36px,5.6vw,68px)", lineHeight: 1, letterSpacing: "-0.045em", fontWeight: 800, maxWidth: 820 }}>Money should move as fast as your group chat.</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24, marginTop: 48 }}>
        {items.map((it) => (
          <div key={it.t} className="card card-hover reveal" style={{ background: "#fff", padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, background: it.bg, border: "2px solid #0B120D", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0B120D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{it.icon}</svg>
            </span>
            <h3 style={{ margin: "6px 0 0", fontSize: 22, letterSpacing: "-0.02em", fontWeight: 800 }}>{it.t}</h3>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "#3A4A3F", fontWeight: 500 }}>{it.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinalCta() {
  return (
    <div className="wrap" style={{ paddingTop: 120, paddingBottom: 64 }}>
      <div className="reveal" style={{ position: "relative", background: "#0B120D", color: "#fff", borderRadius: 44, padding: "clamp(40px,7vw,96px) clamp(24px,5vw,72px)", overflow: "hidden", textAlign: "center", border: "2px solid #0B120D" }}>
        <div className="float cta-float" style={{ ["--r" as string]: "-8deg", position: "absolute", left: "5%", top: "14%", width: 74, height: 74, borderRadius: "50%", background: "#FFD93D", border: "2px solid #fff" }} />
        <div className="float2 cta-float" style={{ ["--r" as string]: "6deg", position: "absolute", right: "7%", bottom: "16%", width: 56, height: 56, borderRadius: "50%", background: "#12E26B", border: "2px solid #fff" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "clamp(64px,15vw,200px)", lineHeight: 0.88, fontWeight: 800, letterSpacing: "-0.07em", color: "#12E26B" }}>Gbam.</div>
          <p style={{ margin: "28px auto 0", maxWidth: 520, fontSize: "clamp(18px,2.2vw,24px)", lineHeight: 1.45, fontWeight: 600, color: "#E3EBE5" }}>Send money to anyone, even if they have never used crypto.</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginTop: 40 }}>
            <Link href="/gift/new" className="btn btn-green btn-green-on-dark">Send a Gift</Link>
            <Link href="/split/new" className="btn btn-ink">Split a Bill</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
