import Link from "next/link";
import { Wordmark } from "./wordmark";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#goaldrop", label: "GoalDrop" },
  { href: "#tournaments", label: "Tournaments" },
  { href: "https://github.com/tetherto", label: "Docs" },
];

export function SiteNav() {
  return (
    <header className="w-full">
      <div className="shell h-28 flex items-center justify-between gap-4">
        <Link href="/">
          <Wordmark />
        </Link>
        <nav
          className="hidden md:flex items-center gap-6 bg-paper-white px-6 py-3"
          style={{ borderRadius: "var(--radius-nav)" }}
        >
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="text-slate hover:text-carbon-black" style={{ fontWeight: 500 }}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/dashboard" className="btn btn-primary">
          Open Dashboard
        </Link>
      </div>
    </header>
  );
}
