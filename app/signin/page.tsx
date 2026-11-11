"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/ui";
import { SignInBlock } from "@/components/signin-card";
import { useWallet } from "@/components/wallet-context";

function SignIn() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/gift/new";
  const { wallet, loaded } = useWallet();
  useEffect(() => {
    if (loaded && wallet) router.replace(next);
  }, [loaded, wallet, next, router]);

  return (
    <AppShell>
      <div className="app-card slide-in">
        <div style={{ fontSize: "clamp(36px,8vw,48px)", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}>
          Hey there.
        </div>
        <p style={{ margin: "12px 0 24px", fontSize: 17, lineHeight: 1.5, color: "#3A4A3F", fontWeight: 500 }}>
          One tap with your fingerprint and you&apos;re ready to send and receive money.
        </p>
        <SignInBlock onDone={() => router.replace(next)} />
      </div>
    </AppShell>
  );
}

export default function Page() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
