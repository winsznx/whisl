import Link from "next/link";

// Shown on the public/hosted instance (no wallet) where write actions don't belong. Whisl is
// local-first: creating pots and cups happens on your own node, not a shared hosted site.
export function RunLocally({ action = "do this" }: { action?: string }) {
  return (
    <div className="card max-w-2xl">
      <span className="tag">LOCAL INSTANCE</span>
      <h2 className="heading-secondary mt-4" style={{ fontSize: "var(--text-heading-sm)" }}>
        Run your own Whisl node to {action}
      </h2>
      <p className="text-slate mt-3" style={{ fontSize: "var(--text-body-sm)" }}>
        Whisl runs one instance per participant, each with its own wallet on its own machine. This
        public site is the landing page and the shared receipts. To create pots and cups and sign
        transactions, run your own node.
      </p>
      <div className="flex flex-wrap gap-3 mt-6">
        <a href="https://github.com/winsznx/whisl" target="_blank" rel="noreferrer" className="btn btn-primary">Get the code</a>
        <Link href="/dashboard" className="btn btn-ghost">Back to dashboard</Link>
      </div>
    </div>
  );
}
