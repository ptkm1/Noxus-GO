export function computeCatalogTileWidths(windowWidth: number) {
  const catalogGap = 10;
  const catalogPad = 16;
  const tileW = Math.max(140, (windowWidth - catalogPad * 2 - catalogGap) / 2);
  const railTileW = Math.min(158, Math.max(136, tileW));
  return { catalogGap, catalogPad, tileW, railTileW };
}
