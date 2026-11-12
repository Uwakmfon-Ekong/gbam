"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Keypair } from "@stellar/stellar-sdk";
import { api, fetchBalance, signAndSubmit, trustState, type Prepared } from "@/lib/api";
import { createWallet, getSaved, restoreWallet, signOut as wipe, unlock, type SavedWallet } from "@/lib/wallet";

type Ctx = {
  loaded: boolean;
  wallet: SavedWallet | null;
  balance: number | null;
  refreshBalance: () => Promise<number | null>;
  signUp: (name: string) => Promise<SavedWallet>;
  restore: () => Promise<SavedWallet>;
  signOut: () => void;
  key: () => Promise<Keypair>;
  topUp: () => Promise<void>;
};

const WalletCtx = createContext<Ctx | null>(null);

async function activate(w: SavedWallet, kp: Keypair) {
  const r = await api<{ ready: boolean; prepared?: Prepared }>("/api/wallet/activate", { pub: w.pub, name: w.name });
  if (!r.ready && r.prepared) await signAndSubmit(r.prepared, kp);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<SavedWallet | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    setWallet(getSaved());
    setLoaded(true);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!wallet) return null;
    try {
      const b = await fetchBalance(wallet.pub);
      setBalance(b);
      return b;
    } catch {
      return null;
    }
  }, [wallet]);

  useEffect(() => {
    if (!wallet) return;
    refreshBalance();
    const t = setInterval(refreshBalance, 8000);
    return () => clearInterval(t);
  }, [wallet, refreshBalance]);

  const signUp = useCallback(async (name: string) => {
    const { wallet: w, kp } = await createWallet(name);
    await activate(w, kp);
    setWallet(w);
    return w;
  }, []);

  const restore = useCallback(async () => {
    const { wallet: w, kp } = await restoreWallet();
    await activate(w, kp);
    setWallet(w);
    return w;
  }, []);

  const signOut = useCallback(() => {
    wipe();
    setWallet(null);
    setBalance(null);
  }, []);

  const topUp = useCallback(async () => {
    if (!wallet) return;
    await api("/api/wallet/faucet", { pub: wallet.pub });
    await refreshBalance();
  }, [wallet, refreshBalance]);

  // Unlock the key; if this wallet predates the current USDC asset, quietly add the trustline first.
  const key = useCallback(async () => {
    const kp = await unlock();
    if (wallet && (await trustState(wallet.pub)) !== "ok") {
      await activate(wallet, kp);
      refreshBalance();
    }
    return kp;
  }, [wallet, refreshBalance]);

  const topUpSafe = useCallback(async () => {
    if (wallet && (await trustState(wallet.pub)) !== "ok") await key();
    await topUp();
  }, [wallet, key, topUp]);

  const value = useMemo(
    () => ({ loaded, wallet, balance, refreshBalance, signUp, restore, signOut, key, topUp: topUpSafe }),
    [loaded, wallet, balance, refreshBalance, signUp, restore, signOut, key, topUpSafe],
  );
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet() {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("useWallet outside WalletProvider");
  return c;
}