import Link from "next/link";
import { Wordmark } from "./wordmark";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/dashboard/pots/new", label: "New pot" },
  { href: "/dashboard/tournaments", label: "Tournaments" },
  { href: "/dashboard/history", label: "History" },
];

export function DashNav() {
  return (
    <header className="w-full border-b border-ash">
      <div className="shell h-20 flex items-center justify-between gap-4">
        <Link href="/">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-slate hover:text-carbon-black whitespace-nowrap"
              style={{ fontWeight: 500, fontSize: "var(--text-body-sm)" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
