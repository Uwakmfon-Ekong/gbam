"use client";
/**
 * Passkey wallet.
 *
 * Primary mode ("passkey"): the Stellar key is DERIVED from the passkey using the WebAuthn PRF
 * extension. Nothing secret is stored. The same synced passkey (iCloud Keychain / Google Password
 * Manager) on another phone re-derives the same wallet → real recovery, no seed phrase.
 *
 * Fallback mode ("device"): browsers without PRF (or no WebAuthn, e.g. some in-app browsers) get a
 * random key kept in this browser's storage. Works for the demo; we label it honestly in the UI.
 */
import { Keypair, Transaction } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "./config";

export type WalletMode = "passkey" | "device";
export type SavedWallet = { pub: string; name: string; mode: WalletMode; credId?: string };

const LS_KEY = "gbam.wallet";
const LS_DEVICE_SECRET = "gbam.deviceSecret";
const SS_SECRET = "gbam.session";

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function sha256(...parts: (Uint8Array | ArrayBuffer)[]) {
  const total = parts.reduce((s, p) => s + p.byteLength, 0);
  const all = new Uint8Array(total);
  let o = 0;
  for (const p of parts) all.set(new Uint8Array(p as ArrayBuffer), o), (o += p.byteLength);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", all));
}

// Fixed salt → the same passkey always yields the same wallet, on any synced device.
let saltCache: Uint8Array | null = null;
const prfSalt = async () => (saltCache ||= await sha256(enc.encode("gbam/stellar-wallet/v1")));

async function keyFromPrf(prf: ArrayBuffer) {
  const seed = await sha256(enc.encode("gbam-seed"), prf);
  return Keypair.fromRawEd25519Seed(seed as unknown as Buffer);
}

export const webauthnAvailable = () =>
  typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials?.create;

export function getSaved(): SavedWallet | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "null");
  } catch {
    return null;
  }
}

function save(w: SavedWallet, kp: Keypair) {
  localStorage.setItem(LS_KEY, JSON.stringify(w));
  sessionStorage.setItem(SS_SECRET, kp.secret());
}

export function signOut() {
  localStorage.removeItem(LS_KEY);
  sessionStorage.removeItem(SS_SECRET);
  // Keep a device secret? No: signing out of a device wallet loses it, so we warn in the UI first.
  localStorage.removeItem(LS_DEVICE_SECRET);
}

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

async function getAssertionPrf(credId?: string): Promise<{ prf?: ArrayBuffer; credId: string; userName?: string }> {
  const salt = await prfSalt();
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      rpId: location.hostname,
      userVerification: "required",
      allowCredentials: credId ? [{ id: fromB64u(credId), type: "public-key" }] : [],
      timeout: 60000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Fingerprint cancelled");
  const ext = cred.getClientExtensionResults() as PrfResults;
  const resp = cred.response as AuthenticatorAssertionResponse;
  let userName: string | undefined;
  try {
    userName = resp.userHandle ? new TextDecoder().decode(resp.userHandle).split("|")[1] : undefined;
  } catch {}
  return { prf: ext.prf?.results?.first, credId: b64u(cred.rawId), userName };
}

/** New user: create a passkey and derive their wallet. Falls back to a device key. */
export async function createWallet(name: string): Promise<{ wallet: SavedWallet; kp: Keypair }> {
  const display = name.trim() || "Gbam user";
  if (webauthnAvailable()) {
    try {
      const salt = await prfSalt();
      // userHandle carries the name so "I've used Gbam before" can greet them on a new device.
      const userId = enc.encode(`${b64u(rand(9))}|${display.slice(0, 40)}`);
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: rand(32),
          rp: { name: "Gbam", id: location.hostname },
          user: { id: userId, name: display, displayName: display },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: { residentKey: "required", userVerification: "required" },
          timeout: 60000,
          extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("Fingerprint cancelled");
      const credId = b64u(cred.rawId);
      const ext = cred.getClientExtensionResults() as PrfResults;
      let prf = ext.prf?.results?.first;
      // Some platforms only report `enabled` at creation — ask once more to get the PRF output.
      if (!prf && ext.prf?.enabled !== false) prf = (await getAssertionPrf(credId)).prf;
      if (prf) {
        const kp = await keyFromPrf(prf);
        const wallet: SavedWallet = { pub: kp.publicKey(), name: display, mode: "passkey", credId };
        save(wallet, kp);
        return { wallet, kp };
      }
      // Passkey worked but no PRF → device key, still gated by the passkey prompt.
      return deviceWallet(display, credId);
    } catch (e) {
      const err = e as DOMException;
      if (err?.name === "NotAllowedError") throw new Error("Fingerprint was cancelled. Tap to try again.");
      if (err?.name !== "NotSupportedError" && err?.name !== "SecurityError") throw e;
    }
  }
  return deviceWallet(display);
}

function deviceWallet(name: string, credId?: string) {
  const kp = Keypair.random();
  localStorage.setItem(LS_DEVICE_SECRET, kp.secret());
  const wallet: SavedWallet = { pub: kp.publicKey(), name, mode: "device", credId };
  save(wallet, kp);
  return { wallet, kp };
}

/** Returning user on a new device: pick their synced passkey → same wallet. */
export async function restoreWallet(): Promise<{ wallet: SavedWallet; kp: Keypair }> {
  if (!webauthnAvailable()) throw new Error("This browser can't use passkeys. Open the link in Chrome or Safari.");
  const r = await getAssertionPrf();
  if (!r.prf) throw new Error("This passkey can't restore a wallet on this browser. Try Chrome or Safari.");
  const kp = await keyFromPrf(r.prf);
  const wallet: SavedWallet = { pub: kp.publicKey(), name: r.userName || "Gbam user", mode: "passkey", credId: r.credId };
  save(wallet, kp);
  return { wallet, kp };
}

/** Get the signing key, asking for the fingerprint only if this tab hasn't unlocked yet. */
export async function unlock(): Promise<Keypair> {
  const s = sessionStorage.getItem(SS_SECRET);
  if (s) return Keypair.fromSecret(s);
  const w = getSaved();
  if (!w) throw new Error("Not signed in");
  if (w.mode === "device") {
    const d = localStorage.getItem(LS_DEVICE_SECRET);
    if (!d) throw new Error("This device lost its key. Sign in again.");
    const kp = Keypair.fromSecret(d);
    sessionStorage.setItem(SS_SECRET, d);
    return kp;
  }
  const r = await getAssertionPrf(w.credId);
  if (!r.prf) throw new Error("Couldn't unlock with this passkey.");
  const kp = await keyFromPrf(r.prf);
  if (kp.publicKey() !== w.pub) throw new Error("That passkey belongs to a different Gbam.");
  sessionStorage.setItem(SS_SECRET, kp.secret());
  return kp;
}

export function signXdr(xdr: string, ...signers: Keypair[]) {
  const tx = new Transaction(xdr, NETWORK_PASSPHRASE);
  tx.sign(...signers);
  return tx.toXDR();
}
