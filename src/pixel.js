// Pixel-art post-processing: turns anti-aliased vector drawings into crisp, outlined pixel sprites.
// Used to bake character/demon/nanobot frames (render.js) and UI icons (icons.js).

const OUTLINE = [10, 8, 18];

// Hard-edge the alpha (no half-transparent fringe) and add a 1px dark outline around the shape.
export function crispen(canvas, { threshold = 96, outline = true } = {}) {
  const x = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3];
    if (a >= threshold) {
      solid[i] = 1; // getImageData colours are un-premultiplied, so only alpha needs hardening
      d[i * 4 + 3] = 255;
    } else d[i * 4 + 3] = 0;
  }
  if (outline) {
    for (let y = 0; y < h; y++) {
      for (let px = 0; px < w; px++) {
        const i = y * w + px;
        if (solid[i]) continue;
        if ((px > 0 && solid[i - 1]) || (px < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
          d[i * 4] = OUTLINE[0];
          d[i * 4 + 1] = OUTLINE[1];
          d[i * 4 + 2] = OUTLINE[2];
          d[i * 4 + 3] = 255;
        }
      }
    }
  }
  x.putImageData(img, 0, 0);
  return canvas;
}

// A white silhouette of a sprite (hit flash).
export function silhouette(canvas, color = [255, 255, 255]) {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const x = c.getContext('2d');
  x.drawImage(canvas, 0, 0);
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] && !(d[i] === OUTLINE[0] && d[i + 1] === OUTLINE[1] && d[i + 2] === OUTLINE[2])) {
      d[i] = color[0];
      d[i + 1] = color[1];
      d[i + 2] = color[2];
    }
  }
  x.putImageData(img, 0, 0);
  c.ox = canvas.ox;
  c.oy = canvas.oy;
  return c;
}

// Downsample a vector-drawn canvas by `factor`, crispen it, then scale back up with hard pixel edges.
export function pixelizeIcon(src, factor = 2) {
  const small = document.createElement('canvas');
  small.width = Math.round(src.width / factor);
  small.height = Math.round(src.height / factor);
  const sx = small.getContext('2d');
  sx.imageSmoothingQuality = 'high';
  sx.drawImage(src, 0, 0, small.width, small.height);
  crispen(small, { threshold: 90 });
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ox = out.getContext('2d');
  ox.imageSmoothingEnabled = false;
  ox.drawImage(small, 0, 0, out.width, out.height);
  return out;
}
