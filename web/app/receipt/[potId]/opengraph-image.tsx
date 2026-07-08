import { ImageResponse } from "next/og";
import { readPot } from "@/lib/chain";
import { STATE_LABEL, PotState, usdt, shortHash } from "@/lib/pot";

export const alt = "Whisl settlement receipt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ReceiptOg({ params }: { params: Promise<{ potId: string }> }) {
  const { potId } = await params;
  let amount = "0";
  let state = "Not found";
  let result = potId;
  try {
    if (/^0x[0-9a-fA-F]{64}$/.test(potId)) {
      const pot = await readPot(potId as `0x${string}`);
      if (pot.state !== PotState.None) {
        amount = usdt(pot.totalDeposited);
        state = STATE_LABEL[pot.state];
        result = pot.resultHash;
      }
    }
  } catch {}

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000000", color: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 800 }}>Whisl</div>
          <div style={{ background: "#d1ffca", color: "#000", borderRadius: 64, padding: "10px 28px", fontSize: 22, fontWeight: 600 }}>
            REFEREE CONFIRMED PAYOUT
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, color: "#979797" }}>FINAL REWARD</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
            <span style={{ fontSize: 128, fontWeight: 800, lineHeight: 1 }}>{amount}</span>
            <span style={{ fontSize: 40, color: "#979797", paddingBottom: 16 }}>USD-T</span>
          </div>
          <div style={{ display: "flex", background: "#d1ffca", color: "#000", borderRadius: 64, padding: "8px 24px", fontSize: 26, fontWeight: 600, alignSelf: "flex-start", marginTop: 20 }}>
            {state}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#979797" }}>
          result {shortHash(result, 8, 6)} · sepolia
        </div>
      </div>
    ),
    { ...size },
  );
}
