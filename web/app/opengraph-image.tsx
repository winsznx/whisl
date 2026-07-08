import { ImageResponse } from "next/og";

export const alt = "Whisl · turn the whistle into settlement";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#e5e5e5",
          color: "#000000",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -2 }}>Whisl</div>
          <div style={{ background: "#d1ffca", borderRadius: 64, padding: "10px 28px", fontSize: 22, fontWeight: 600 }}>
            PEARS · QVAC · WDK
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 104, fontWeight: 800, lineHeight: 1.0, letterSpacing: -4, textTransform: "uppercase" }}>
          Turn the whistle into settlement
        </div>

        {/* scoreboard motif */}
        <div style={{ display: "flex", background: "#000000", color: "#ffffff", borderRadius: 28, padding: "22px 34px", alignItems: "center", gap: 22, alignSelf: "flex-start" }}>
          <span style={{ fontSize: 34, fontWeight: 800 }}>NGA</span>
          <span style={{ fontSize: 46, fontWeight: 800, color: "#d1ffca" }}>1</span>
          <span style={{ fontSize: 34, color: "#979797" }}>–</span>
          <span style={{ fontSize: 46, fontWeight: 800 }}>0</span>
          <span style={{ fontSize: 34, fontWeight: 800 }}>CMR</span>
          <span style={{ fontSize: 20, color: "#979797", marginLeft: 12 }}>GoalDrop · 42 USDT pot</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
