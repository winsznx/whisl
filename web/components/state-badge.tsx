import { STATE_LABEL, STATE_TINT } from "@/lib/pot";

const TINT: Record<string, React.CSSProperties> = {
  mint: { background: "var(--color-mint-chip)", color: "#000" },
  yellow: { background: "var(--color-voltage-yellow)", color: "#000" },
  dark: { background: "#000", color: "#fff" },
  neutral: { background: "var(--color-mist-gray)", color: "var(--color-slate)" },
};

export function StateBadge({ state }: { state: number }) {
  const tint = STATE_TINT[state] ?? "neutral";
  return (
    <span
      className="inline-flex items-center"
      style={{ ...TINT[tint], borderRadius: 64, padding: "6px 14px", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "-0.03em", textTransform: "uppercase" }}
    >
      {STATE_LABEL[state] ?? "Unknown"}
    </span>
  );
}
