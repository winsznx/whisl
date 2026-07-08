import Link from "next/link";
import { Wordmark } from "./wordmark";
import { ESCROW, EXPLORER } from "@/lib/chain";
import { shortHash } from "@/lib/pot";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-carbon-black text-paper-white">
      <div className="shell py-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10">
          <Wordmark className="text-paper-white" />
          <div className="flex flex-wrap gap-x-10 gap-y-3" style={{ fontWeight: 500 }}>
            <a href="https://github.com/tetherto" target="_blank" rel="noreferrer" className="hover:text-mint-chip">GitHub</a>
            <a href="https://docs.qvac.tether.io" target="_blank" rel="noreferrer" className="hover:text-mint-chip">Docs</a>
            <Link href="/" className="hover:text-mint-chip">License</Link>
            <a href={`${EXPLORER}/address/${ESCROW}`} target="_blank" rel="noreferrer" className="hover:text-mint-chip">
              Escrow {shortHash(ESCROW)}
            </a>
          </div>
        </div>
        <p className="mono-label text-smoke mt-12">
          BUILT FOR THE TETHER DEVELOPERS CUP. PEARS, QVAC, WDK, ALL THREE LOAD-BEARING.
        </p>
      </div>
    </footer>
  );
}
