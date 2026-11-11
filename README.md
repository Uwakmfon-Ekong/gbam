# Gbam

Send money like a WhatsApp message. Built on Stellar for Boundless Build Day, Uyo, 12 Nov 2026.

- **Gbam Gift**: send USDC to someone who has never used crypto. They open a WhatsApp link, sign in with their fingerprint, tap Claim.
- **Gbam Split**: photograph a bill, Claude reads it, assign items, every friend gets a pay link, watch "3 of 5 paid" update live.

No wallet. No seed phrase. No fees.

---

## Tonight: get it running (≈20 min)

```bash
npm install
npm test                 # offline: tx shapes + split math (no network)
npm run setup:stellar    # creates sponsor + test-USDC issuer on testnet, writes .env.local
npm run proof            # the PRD's "do this before any screens" check, live on testnet
```

`npm run proof` creates two 0-XLM wallets, sends a gift to an unknown receiver, claims it, then makes a 5-second gift and takes it back on-chain. **If it prints ✅, Gift Links work.** If it fails, the error shows the exact Stellar result code. Send it to me.

Then:

1. **Supabase**: new project → SQL Editor → paste `supabase/schema.sql` → Run. Copy the URL and the `service_role` key into `.env.local`.
2. **Claude**: put `ANTHROPIC_API_KEY` in `.env.local`.
3. `npm run dev` → open http://localhost:3000. Check http://localhost:3000/api/health. Everything should be green.

> Without Supabase the app uses in-memory storage. That works for `npm run dev` on one laptop, **not** on Vercel.

## Soroban gift escrow contract (optional, recommended for the pitch)

`contracts/gift-escrow` is our own Soroban smart contract for gifts:

- `create(sender, link, amount, window)` locks USDC.
- `claim(link, to, sig)` pays out only if the **link key signed the receiver's address**, so a stolen claim can't be redirected.
- `refund(link)` lets the sender take it back after the window.

Unlike claimable balances, it leaves no throwaway account behind, and it already works for C… smart-wallet addresses.

```bash
npm run test:contract          # 7 Rust tests, incl. a check that JS and Rust sign the same bytes
cd contracts && stellar contract build && cd ..   # needs the Stellar CLI + wasm32v1-none target
npm run deploy:contract        # wraps test USDC in its SAC, uploads + deploys, writes GIFT_CONTRACT_ID
npm run proof:contract         # create → claim → 5s refund, live on testnet
```

When `proof:contract` prints ✅, set `GIFT_MODE=contract` (locally and in Vercel). New gifts then go through the contract, and old classic gifts keep working. If anything misbehaves on stage, set it back to `classic`.

If `deploy:contract` fails with a protocol/version error, change `soroban-sdk` in `contracts/Cargo.toml` to the version that matches testnet's protocol and rebuild.

## Deploy (Vercel)

1. Push to GitHub, import in Vercel.
2. Add every variable from `.env.local` to Vercel → Settings → Environment Variables. Skip `ISSUER_SECRET`; only the setup script needs it.
3. Deploy, then open `https://<your-app>/api/health`.
4. **Always demo on the production URL.** Passkeys are tied to the domain, so a passkey made on a preview URL won't work on another one.

## How it works on Stellar

| Step | What happens on-chain | Who pays |
|---|---|---|
| Sign in | Account created with **0 XLM** + USDC trustline, reserves **sponsored** (CAP-33) | App sponsor |
| Create gift | **Claimable balance** with 2 claimants: a throwaway *link key* (before expiry) and the sender (after expiry) | Fee-bump by app |
| Share | Link = `/g/<id>#<link-key-secret>`. The `#fragment` never reaches our server or WhatsApp's preview bot | n/a |
| Claim | **One atomic tx**: create link-key account → trustline → claim → pay receiver → close trustline | Fee-bump by app |
| Take it back | Sender claims the balance after expiry. **Enforced by Stellar, not our server** | Fee-bump by app |
| Pay share | Plain USDC payment friend → bill payer | Fee-bump by app |

**Why a link key?** Claimable-balance claimants are fixed when the balance is created, and the receiver doesn't have a wallet yet. So the gift is claimable by a fresh keypair whose secret only exists in the link.

**Passkeys.** The Stellar key is *derived* from the passkey with the WebAuthn **PRF** extension (`lib/wallet.ts`). Nothing secret is stored. The same synced passkey on a new phone (iCloud Keychain / Google Password Manager) re-creates the same wallet ("I've used Gbam before"). Browsers without PRF fall back to a key kept on the device, and the menu says so honestly.

Every user transaction is built by the server, signed on the device, and verified against an HMAC token before the sponsor fee-bumps it (`app/api/tx/submit`). The sponsor can't be tricked into paying for arbitrary transactions.

## Extras worth knowing

- **`/check`**: a pre-demo status page with sponsor XLM and USDC float, database, Claude key, whether the gift contract is live, and demo settings. Open it on the venue Wi-Fi before you pitch. It's linked as "Status" in the footer.
- **Gift sharing**: WhatsApp, the phone's own share sheet, copy link, a **QR code** for handing a gift to a judge in person, and a gift card image.
- **Split**: **Nudge** sends a friendly WhatsApp reminder. The bill payer can **mark a friend as paid in cash or transfer**. Receipt photos can come from the camera or the gallery.
- **WhatsApp previews** for both gift links and pay links (`/g/[id]` and `/p/[id]` preview images).
- **≈ ₦ everywhere money shows** (demo rate), plus an honest "cash-out coming soon" note.
- **Add to Home Screen** works (`manifest.webmanifest`). Opening Gbam from the home screen on stage looks like a native app.

## Demo-day checklist

- [ ] Set `NEXT_PUBLIC_GIFT_EXPIRY_SECONDS=120` in Vercel and redeploy, so "Take it back" can be shown live.
- [ ] Sponsor has XLM: re-run `npm run setup:stellar` (it tops up). Each claimed gift leaves ~1 XLM of sponsor reserve behind (see Limits).
- [ ] Test on 2 real phones: iPhone Safari + Android Chrome. Also open a link **from inside WhatsApp**.
- [ ] Pre-make a sender wallet on the demo phone and tap **+ Add $25 test money** in the menu.
- [ ] Record a backup video of the full flow.
- [ ] `/check` is all green on the production URL.

## 3-minute demo script

1. **Hook (20s).** "How do you send money to someone who has never used crypto?"
2. **Gift (60s).** On your phone: Send a Gift → $10 + message → Create link → Share on WhatsApp to a judge. The judge's phone shows the preview "Tomiwa sent you $10". They tap → Claim → fingerprint → **Gbam.** with confetti. Your screen flips to **Claimed** by itself. Tap "View transaction" to show it on Stellar Expert.
3. **Split (80s).** Split a Bill → photo (or **Try demo receipt** if the Wi-Fi is bad) → fix one line to show editing → add Ada and Chidi → tap items → Create payment links → send Ada's link → on a second phone Ada pays → status goes **1 of 2 paid** live.
4. **Close (20s).** "No wallet, no seed phrase, no fees. The take-back is enforced by Stellar itself, and your fingerprint *is* your wallet, even on a new phone."

**Say it before a judge asks.** Friends on Split need USDC to pay. In the demo that's the "Add test money" button. In production it's a naira on-ramp (bank transfer / card via Paystack or Flutterwave).

## Code map

```
lib/txbuilders.ts      every Stellar transaction (pure, unit-tested)
lib/stellar-server.ts  sponsor key, fee-bump, submit, HMAC intent tokens, friendly errors
lib/wallet.ts          passkey (WebAuthn PRF) → Stellar key; device fallback
lib/split.ts           naira parsing, proportional tax/service, demo receipt
lib/db.ts              Supabase `records` table (memory fallback in dev)
app/api/...            prepare → sign on device → /api/tx/submit
app/g/[id]             public Claim page (+ WhatsApp preview image)
app/p/[id]             public Pay page
scripts/setup.mjs      testnet accounts + test USDC
scripts/proof.ts       end-to-end on-chain proof
```

## Known limits (be upfront about these)

- **The link is cash.** Anyone with it can claim. The status page says so.
- **Leftover link-key accounts.** Stellar won't merge an account in the same ledger it was created (`ACCOUNT_MERGE_SEQNUM_TOO_FAR`), so each claim leaves an empty sponsored account (~1 XLM of sponsor reserve). A cleanup job could merge them later.
- **Testnet test-USDC.** The asset is issued by our own testnet issuer, not Circle's, so we can mint for the demo.
- **Fixed FX rate** for Split (`NEXT_PUBLIC_NGN_PER_USD`).
- **No naira cash-out yet.** Claimed money stays in the receiver's Gbam as test USDC, and we show the ≈₦ value. Production cash-out would go through a licensed Stellar anchor (SEP-24) into a Nigerian bank account.
- **Device-mode wallets** (no PRF support) are lost if the browser storage is cleared.
- **Live status uses polling** (every 2s), not websockets. That's enough for a demo.
