import { DashNav } from "@/components/dash-nav";
import { walletConfigured } from "@/lib/server/wdk";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ready = walletConfigured();
  return (
    <>
      <DashNav />
      <main className="flex-1">
        <div className="shell py-10">
          {!ready ? (
            <div
              className="mb-8"
              style={{ background: "var(--color-mint-chip)", color: "#000", borderRadius: 16, padding: "16px 20px" }}
            >
              <div className="mono-label">PUBLIC SITE, READ ONLY</div>
              <p className="mt-1" style={{ fontSize: "var(--text-body-sm)" }}>
                Whisl runs one instance per participant. This hosted site is the landing page and the
                shared receipts. Creating pots and cups and signing transactions happens on your own
                local node. <a href="https://github.com/winsznx/whisl" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>Run your own</a>.
              </p>
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </>
  );
}
