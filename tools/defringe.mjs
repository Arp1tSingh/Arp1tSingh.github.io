/* Removes the baked-in white "sticker" fringe from a background-removed cutout.
   1. Erode the alpha silhouette by R px with a disc structuring element.
   2. Bleed the interior colours outward so the soft edge carries real
      subject colour instead of white (kills any remaining halo).
   Usage: node defringe.mjs <in.png> <out.png> [radius]                */
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , inPath, outPath, radiusArg] = process.argv;
const R = Number(radiusArg ?? 7);

const src = PNG.sync.read(fs.readFileSync(inPath));
const { width: W, height: H, data: d } = src;

// ---- 1. disc offsets ---------------------------------------------------
const offs = [];
for (let dy = -R; dy <= R; dy++) {
  for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy <= R * R) offs.push([dx, dy]);
  }
}

// ---- 2. erode alpha ----------------------------------------------------
const a = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3];

const eroded = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let m = 255;
    for (const [dx, dy] of offs) {
      const nx = x + dx, ny = y + dy;
      const v = nx < 0 || ny < 0 || nx >= W || ny >= H ? 0 : a[ny * W + nx];
      if (v < m) { m = v; if (m === 0) break; }
    }
    eroded[y * W + x] = m;
  }
}

// ---- 3. bleed interior colours outward ---------------------------------
const isCore = new Uint8Array(W * H);
const rgb = new Uint8ClampedArray(W * H * 3);
for (let i = 0; i < W * H; i++) {
  rgb[i * 3] = d[i * 4];
  rgb[i * 3 + 1] = d[i * 4 + 1];
  rgb[i * 3 + 2] = d[i * 4 + 2];
  isCore[i] = eroded[i] >= 250 ? 1 : 0;
}

// Multi-pass diffusion: each pass lets already-known pixels donate colour.
const known = Uint8Array.from(isCore);
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

for (let pass = 0; pass < 8; pass++) {
  const next = Uint8Array.from(known);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (known[i] || eroded[i] === 0) continue;

      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of NB) {
        const j = (y + dy) * W + (x + dx);
        if (known[j]) {
          r += rgb[j * 3]; g += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; n++;
        }
      }
      if (n) {
        rgb[i * 3] = r / n; rgb[i * 3 + 1] = g / n; rgb[i * 3 + 2] = b / n;
        next[i] = 1;
      }
    }
  }
  known.set(next);
}

// ---- 4. write ----------------------------------------------------------
const out = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) {
  const alpha = eroded[i];
  out.data[i * 4] = alpha === 0 ? 0 : rgb[i * 3];
  out.data[i * 4 + 1] = alpha === 0 ? 0 : rgb[i * 3 + 1];
  out.data[i * 4 + 2] = alpha === 0 ? 0 : rgb[i * 3 + 2];
  out.data[i * 4 + 3] = alpha;
}
fs.writeFileSync(outPath, PNG.sync.write(out));

console.log(`radius=${R} offsets=${offs.length}`);
console.log(`core px: ${isCore.reduce((s, v) => s + v, 0)} / ${W * H}`);
