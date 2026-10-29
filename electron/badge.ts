import { nativeImage } from "electron";

export function badgeImage() {
  const size = 32;
  const buffer = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size / 2 - 1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center);
      const alpha = Math.min(1, Math.max(0, radius - distance + 0.5));
      if (!alpha) continue;
      const ring = distance > radius - 3.2;
      const [r, g, b] = ring ? [255, 255, 255] : [255, 122, 26];
      const offset = (y * size + x) * 4;
      buffer[offset] = Math.round(b * alpha);
      buffer[offset + 1] = Math.round(g * alpha);
      buffer[offset + 2] = Math.round(r * alpha);
      buffer[offset + 3] = Math.round(255 * alpha);
    }
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size, scaleFactor: 2 });
}
