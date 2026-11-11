// Public config: safe to import from client and server.
export const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
export const ASSET_CODE = process.env.NEXT_PUBLIC_ASSET_CODE || "USDC";
export const ASSET_ISSUER = process.env.NEXT_PUBLIC_ASSET_ISSUER || "";
/** Naira per 1 USD, used to turn receipt totals into what each friend pays. */
export const NGN_PER_USD = Number(process.env.NEXT_PUBLIC_NGN_PER_USD || 1500);
/** How long the receiver has before the sender can take a gift back. Set to 120 for the demo. */
export const GIFT_EXPIRY_SECONDS = Number(process.env.NEXT_PUBLIC_GIFT_EXPIRY_SECONDS || 86400);
export const EXPLORER_TX = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const EXPLORER_ACCOUNT = (id: string) => `https://stellar.expert/explorer/testnet/account/${id}`;
export const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
export const EXPLORER_CONTRACT = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`;
