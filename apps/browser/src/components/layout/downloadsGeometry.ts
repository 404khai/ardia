export function downloadsGeometry(viewport: { width: number; height: number }, anchor: { x: number; y: number; height: number }, footer: boolean) {
  anchor = {
    x: Math.max(16, Math.min(viewport.width - 16, anchor.x)),
    y: Math.max(0, Math.min(viewport.height - anchor.height, anchor.y)),
    height: anchor.height,
  };
  const width = Math.min(320, Math.max(0, viewport.width - 16));
  const below = !footer && viewport.height - anchor.y - anchor.height >= Math.min(260, anchor.y);
  const edge = below ? anchor.y + anchor.height + 2 : viewport.height - anchor.y + 2;
  const left = Math.max(8, Math.min(anchor.x - width / 2, viewport.width - width - 8));
  const pointerX = Math.max(32, Math.min(width - 32, anchor.x - left));
  const maxHeight = Math.max(0, Math.min(8 * 48, viewport.height - edge - 10 - 101.5 - 8));
  return { width, below, edge, left, pointerX, maxHeight };
}
