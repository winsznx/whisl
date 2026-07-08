// Country name / code -> flag emoji. Covers common football nations; unknown names return "".

const ISO2: Record<string, string> = {
  nigeria: "ng", nga: "ng",
  cameroon: "cm", cmr: "cm",
  argentina: "ar", arg: "ar",
  brazil: "br", bra: "br",
  croatia: "hr", cro: "hr",
  france: "fr", fra: "fr",
  england: "gb-eng", eng: "gb-eng",
  spain: "es", esp: "es",
  germany: "de", ger: "de",
  portugal: "pt", por: "pt",
  italy: "it", ita: "it",
  netherlands: "nl", ned: "nl",
  belgium: "be", bel: "be",
  morocco: "ma", mar: "ma",
  ghana: "gh", gha: "gh",
  senegal: "sn", sen: "sn",
  egypt: "eg", egy: "eg",
  ivorycoast: "ci", "ivory coast": "ci", civ: "ci",
  algeria: "dz", alg: "dz",
  tunisia: "tn", tun: "tn",
  southafrica: "za", "south africa": "za", rsa: "za",
  japan: "jp", jpn: "jp",
  southkorea: "kr", "south korea": "kr", kor: "kr",
  usa: "us", "united states": "us", unitedstates: "us",
  mexico: "mx", mex: "mx",
  canada: "ca", can: "ca",
  uruguay: "uy", uru: "uy",
  colombia: "co", col: "co",
  chile: "cl", chi: "cl",
  peru: "pe", per: "pe",
  ecuador: "ec", ecu: "ec",
  australia: "au", aus: "au",
  saudiarabia: "sa", "saudi arabia": "sa", ksa: "sa",
  qatar: "qa", qat: "qa",
  switzerland: "ch", sui: "ch",
  poland: "pl", pol: "pl",
  denmark: "dk", den: "dk",
  sweden: "se", swe: "se",
  norway: "no", nor: "no",
  scotland: "gb-sct", sco: "gb-sct",
  wales: "gb-wls", wal: "gb-wls",
  serbia: "rs", srb: "rs",
  turkey: "tr", tur: "tr",
  greece: "gr", gre: "gr",
  austria: "at", aut: "at",
};

function toEmoji(iso: string): string {
  // handle England/Scotland/Wales subdivisions with tag sequences
  if (iso === "gb-eng") return "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  if (iso === "gb-sct") return "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  if (iso === "gb-wls") return "🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";
  if (iso.length !== 2) return "";
  const cc = iso.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Flag emoji for a country name or code, or "" if unknown. */
export function flag(name: string | null | undefined): string {
  if (!name) return "";
  const key = name.trim().toLowerCase();
  const iso = ISO2[key] ?? (key.length === 2 ? key : undefined);
  return iso ? toEmoji(iso) : "";
}

/** Country name with its flag prepended (or just the name if unknown). */
export function withFlag(name: string | null | undefined): string {
  const f = flag(name);
  return f ? `${f} ${name}` : name ?? "";
}

/** Find the first known country inside free text (e.g. a pot condition) and return its flag. */
export function flagInText(text: string | null | undefined): string {
  if (!text) return "";
  const words = text.split(/[^A-Za-z]+/).filter(Boolean);
  for (const w of words) {
    const f = flag(w);
    if (f) return f;
  }
  return "";
}
