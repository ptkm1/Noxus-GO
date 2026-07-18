/**
 * Gera icon.png, adaptive-icon.png, splash-icon.png e favicon.png
 * a partir do logo commerce pro (Figma).
 *
 * Uso: node scripts/generate-app-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, "../assets");

const LILAC = "#8A3FFC";
const LOGO_PATH =
  "M109.533 102.092L75.0325 63.5918V62.5918H125.533C129.933 62.5918 131.699 65.9251 132.033 67.5918V77.0918L110.533 112.592C105.733 117.392 98.1993 119.925 95.0326 120.592H41.0327C35.4327 120.592 28.4425 113.258 25.6474 109.592L0.532615 66.0918C-0.432002 62.4918 0.130691 55.5918 0.532615 52.5918L27.0326 9.0918C28.4183 6.6918 35.2766 2.42513 38.5325 0.591794C57.1992 0.145212 95.5326 -0.480002 99.5326 0.591794C103.533 1.66359 108.866 8.70504 111.033 12.0918L123.033 29.0918V34.5918C120.03 39.7918 114.115 43.0918 111.533 44.0918H95.0326L93.5326 43.0918C91.7106 36.2918 84.7734 32.5918 81.5326 31.5918H60.0326C53.6326 31.5918 49.3834 34.5918 48.0588 36.0918L38.5325 52.5918C34.5325 56.5918 35.5325 62.2585 36.5325 64.5918L51.5325 86.0918C51.9325 87.2918 53.6992 88.9251 54.5325 89.5918H85.5325L88.0325 83.5918L109.533 102.092Z";

function iconSvg(size, { background = true, logoScale = 0.52 } = {}) {
  const logoW = size * logoScale;
  const logoH = logoW * (121 / 133);
  const x = (size - logoW) / 2;
  const y = (size - logoH) / 2;
  const rx = Math.round(size * 0.22);

  const bg = background
    ? `<rect width="${size}" height="${size}" rx="${rx}" fill="${LILAC}"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <g transform="translate(${x} ${y}) scale(${logoW / 133})">
    <path d="${LOGO_PATH}" fill="#FFFFFF"/>
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
