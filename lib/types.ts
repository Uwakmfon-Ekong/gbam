export type GiftStatus = "pending" | "active" | "claimed" | "reclaimed";

export type Gift = {
  id: string;
  sender: string;
  senderName: string;
  amount: string; // "10.00" USDC
  message: string;
  linkPub: string; // public key of the throwaway "link key"; its secret only lives in the link #fragment
  balanceId: string;
  status: GiftStatus;
  createdAt: number;
  expiresAt: number; // ms; after this the sender can take it back
  claimedAt?: number;
  claimedBy?: string;
  createTx?: string;
  claimTx?: string;
  reclaimTx?: string;
};

/** What the public claim page is allowed to see. */
export type PublicGift = Pick<
  Gift,
  "id" | "senderName" | "amount" | "message" | "status" | "expiresAt" | "linkPub" | "claimedAt" | "claimTx"
>;

export type ReceiptItem = { id: string; name: string; qty: number; price: number }; // price = line total in NGN
export type Charges = { tax: number; service: number; tip: number };
export type Friend = { id: string; name: string; color: string; isPayer?: boolean };

export type Split = {
  id: string;
  payer: string;
  payerName: string;
  merchant: string;
  rate: number; // NGN per USD
  items: ReceiptItem[];
  charges: Charges;
  receiptTotal: number | null; // total printed on the receipt, for the math check
  friends: Friend[];
  assign: Record<string, string[]>; // itemId -> friendIds
  status: "draft" | "sent";
  createdAt: number;
};

export type Share = {
  id: string;
  splitId: string;
  friendId: string;
  name: string;
  color: string;
  payer: string;
  payerName: string;
  merchant: string;
  items: string[]; // human labels: "Jollof rice", "½ Suya platter"
  amountNgn: number;
  amountUsd: string; // "4.20"
  status: "unpaid" | "paid";
  paidBy?: string;
  paidAt?: number;
  tx?: string;
  createdAt: number;
};
