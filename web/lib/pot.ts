// Pot state model (mirrors WhislEscrow.PotState). Plain, readable labels — no jargon.

export const ADDR_ZERO = "0x0000000000000000000000000000000000000000";

export const PotState = {
  None: 0,
  Funding: 1,
  Ready: 2,
  ResolutionSubmitted: 3,
  Confirmed: 4,
  Disputed: 5,
  ResolutionFinal: 6,
  Settled: 7,
  RefundPending: 8,
  Refunded: 9,
  Swept: 10,
  Cancelled: 11,
} as const;

export const STATE_LABEL: Record<number, string> = {
  0: "Not created",
  1: "Funding open",
  2: "Funded and ready",
  3: "Result submitted",
  4: "Dispute window open",
  5: "Under review",
  6: "Ready to claim",
  7: "Settled",
  8: "Refund available",
  9: "Refunded",
  10: "Returned to depositors",
  11: "Cancelled",
};

// Which tint a state badge uses (kept within the design system palette).
export const STATE_TINT: Record<number, "mint" | "yellow" | "dark" | "neutral"> = {
  1: "neutral",
  2: "mint",
  3: "neutral",
  4: "yellow",
  5: "yellow",
  6: "mint",
  7: "dark",
  8: "neutral",
  9: "neutral",
  10: "neutral",
  11: "neutral",
};

export function usdt(amount: bigint | number | string): string {
  const n = typeof amount === "bigint" ? amount : BigInt(amount);
  const whole = n / 1_000_000n;
  const frac = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function shortHash(h: string, lead = 6, tail = 4): string {
  if (!h || h.length <= lead + tail + 2) return h;
  return `${h.slice(0, lead + 2)}…${h.slice(-tail)}`;
}

export function countdown(deadlineSec: number, nowSec: number): string {
  const s = deadlineSec - nowSec;
  if (s <= 0) return "closed";
  if (s < 60) return `${s}s left`;
  if (s < 3600) return `${Math.floor(s / 60)}m left`;
  if (s < 86400) return `${Math.floor(s / 3600)}h left`;
  return `${Math.floor(s / 86400)}d left`;
}
