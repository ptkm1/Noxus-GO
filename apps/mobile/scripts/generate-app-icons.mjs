/**
 * Gera icon.png, adaptive-icon.png, splash-icon.png e favicon.png
 * a partir da marca P PedixPro (SVG shared) + primary teal.
 *
 * Uso: node scripts/generate-app-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "../assets");

const BRAND = "#02445C";
const LOGO_VB_W = 152;
const LOGO_VB_H = 167;
const STEM_PATH = "M48.021 134.5L12.021 165.5V89.5L48.021 57.5V134.5Z";
const LOOP_PATH =
  "M72.521 117V84.5H99.021C113.421 80.6415 116.354 66.559 116.021 60C116.021 43.2 102.688 35.6667 96.021 34H1.021L27.021 0.5H96.021C107.221 0.5 114.021 2.83333 116.021 4C142.021 10.8 150.188 42.5 151.021 57.5C151.021 99.5 122.354 114.667 108.021 117H72.521Z";

function iconSvg(size, { background = true, logoScale = 0.52 } = {}) {
  const logoH = size * logoScale;
  const logoW = logoH * (LOGO_VB_W / LOGO_VB_H);
  const x = (size - logoW) / 2;
  const y = (size - logoH) / 2;
  const rx = Math.round(size * 0.22);
  const scale = logoH / LOGO_VB_H;

  const bg = background
    ? `<rect width="${size}" height="${size}" rx="${rx}" fill="${BRAND}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <g transform="translate(${x} ${y}) scale(${scale})">
    <path d="${STEM_PATH}" fill="#FFFFFF"/>
    <path d="${LOOP_PATH}" fill="#FFFFFF"/>
  </g>
</svg>`;
}

async function writePng(filename, size, opts) {
  const svg = iconSvg(size, opts);
  const out = join(assetsDir, filename);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`✓ ${filename} (${size}×${size})`);
}

mkdirSync(assetsDir, { recursive: true });

await writePng("icon.png", 1024, { background: true });
await writePng("adaptive-icon.png", 1024, {
  background: false,
  logoScale: 0.58,
});
await writePng("splash-icon.png", 512, { background: false, logoScale: 0.62 });
await writePng("favicon.png", 96, { background: true, logoScale: 0.5 });

writeFileSync(
  join(assetsDir, "app-icon.svg"),
  iconSvg(1024, { background: true }),
  "utf8",
);
console.log("✓ app-icon.svg");
