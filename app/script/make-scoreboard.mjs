// Generate a football scoreboard PNG (a real image for QVAC to parse — no mock model output).
import sharp from "sharp";

export async function makeScoreboard(outPath, { home = "NIGERIA", away = "ARGENTINA", hs = 1, as = 0 } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="360">
    <rect width="900" height="360" fill="#0b3d16"/>
    <rect x="0" y="0" width="900" height="70" fill="#0a2e11"/>
    <text x="450" y="48" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#ffffff" text-anchor="middle" font-weight="bold">FIFA WORLD CUP — GROUP D</text>
    <text x="230" y="200" font-family="Helvetica, Arial, sans-serif" font-size="46" fill="#ffffff" text-anchor="middle" font-weight="bold">${home}</text>
    <text x="670" y="200" font-family="Helvetica, Arial, sans-serif" font-size="46" fill="#ffffff" text-anchor="middle" font-weight="bold">${away}</text>
    <rect x="380" y="150" width="140" height="90" rx="10" fill="#111111"/>
    <text x="450" y="215" font-family="Helvetica, Arial, sans-serif" font-size="64" fill="#00e676" text-anchor="middle" font-weight="bold">${hs} - ${as}</text>
    <text x="450" y="300" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#cfe8d4" text-anchor="middle">67:12  •  2nd HALF</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  return outPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || "/tmp/whisl-scoreboard.png";
  await makeScoreboard(out);
  console.log("wrote", out);
}
