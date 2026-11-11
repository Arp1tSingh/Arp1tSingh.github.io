#!/usr/bin/env tsx
/**
 * Builds the social card.
 *
 *   npx tsx scripts/build-og.ts
 *
 * Writes:
 *   public/og/og.png   1200x630, a real PNG assembled byte by byte
 *   public/og/og.svg   the same design as editable SVG
 *
 * There is no image library here and none is needed: a PNG is a signature, a
 * handful of length prefixed chunks and a zlib stream. The only real work is
 * the lettering, which is drawn from a tiny 5x7 bitmap font built into this
 * file, so the card renders the same glyphs everywhere with no font files.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

/* ------------------------------------------------------------------ */
/* Design                                                              */
/* ------------------------------------------------------------------ */

type Rgb = readonly [number, number, number];

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const BACKGROUND: Rgb = [0x00, 0x00, 0x16];
const FOREGROUND: Rgb = [0xf1, 0xf1, 0xf1];
const ACCENT: Rgb = [0xe4, 0x03, 0x2e];
const MUTED: Rgb = [0x97, 0x97, 0xa5];

const TITLE_TEXT = 'ARPIT SINGH';
const SUBTITLE_TEXT = 'THE LOCAL 3D - THREE RENDERERS';

const MARGIN_X = 80;
const TITLE_TOP = 84;
const TITLE_SCALE = 16;
const RULE_TOP = 224;
const RULE_WIDTH = 360;
const RULE_HEIGHT = 8;
const SUBTITLE_TOP = 268;
const SUBTITLE_SCALE = 5;

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const GLYPH_ADVANCE = GLYPH_WIDTH + 1;

/* ------------------------------------------------------------------ */
/* A 5x7 bitmap font. Each glyph is seven hex nibbles, one per row,     */
/* with the low five bits of the nibble being the row's pixels.         */
/* ------------------------------------------------------------------ */

const FONT: Record<string, string> = {
  A: '0E11111F111111',
  B: '1E11111E11111E',
  C: '0E11101010110E',
  D: '1E11111111111E',
  E: '1F10101E10101F',
  F: '1F10101E101010',
  G: '0E11101711110F',
  H: '1111111F111111',
  I: '0E04040404040E',
  J: '0702020202120C',
  K: '11121418141211',
  L: '1010101010101F',
  M: '111B1515111111',
  N: '11191513111111',
  O: '0E11111111110E',
  P: '1E11111E101010',
  Q: '0E11111115120D',
  R: '1E11111E141211',
  S: '0F10100E01011E',
  T: '1F040404040404',
  U: '1111111111110E',
  V: '11111111110A04',
  W: '11111115151B11',
  X: '11110A040A1111',
  Y: '1111110A040404',
  Z: '1F01020408101F',
  '0': '0E11131519110E',
  '1': '040C040404040E',
  '2': '0E11010204081F',
  '3': '1F02040201110E',
  '4': '02060A121F0202',
  '5': '1F101E0101110E',
  '6': '0608101E11110E',
  '7': '1F010204080808',
  '8': '0E11110E11110E',
  '9': '0E11110F01020C',
  ' ': '00000000000000',
  '.': '00000000000C0C',
  ',': '000000000C0408',
  '-': '0000001F000000',
  '_': '0000000000001F',
  '/': '01010204081010',
  ':': '000C0C000C0C00',
  ';': '000C0C000C0408',
  "'": '04040800000000',
  '"': '0A040A00000000',
  '!': '04040404040004',
  '?': '0E11010204000004',
  '(': '02040808080402',
  ')': '08040202020408',
  '[': '0E08080808080E',
  ']': '0E01010101010E',
  '&': '0C12140815120D',
  '+': '0004041F040400',
  '#': '0A1F0A0A1F0A00',
  '*': '11110A040A1111',
  '=': '00001F001F0000',
  '<': '02040810100804',
  '>': '08040201020408',
  '%': '11010204081011',
};

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

class Canvas {
  readonly data: Buffer;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = Buffer.alloc(width * height * 3);
  }

  setPixel(x: number, y: number, color: Rgb): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const offset = (y * this.width + x) * 3;
    this.data[offset] = color[0];
    this.data[offset + 1] = color[1];
    this.data[offset + 2] = color[2];
  }

  fillRect(x: number, y: number, w: number, h: number, color: Rgb): void {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        this.setPixel(xx, yy, color);
      }
    }
  }
}

/** Draws a string with the built in font. Returns the width it took. */
function drawText(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: Rgb,
): number {
  let cursor = x;
  for (const character of text.toUpperCase()) {
    const glyph = FONT[character] ?? FONT['?'];
    for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
      const bits = parseInt(glyph.slice(row * 2, row * 2 + 2), 16);
      for (let col = 0; col < GLYPH_WIDTH; col += 1) {
        if (bits & (1 << (GLYPH_WIDTH - 1 - col))) {
          canvas.fillRect(cursor + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cursor += GLYPH_ADVANCE * scale;
  }
  return text.length === 0 ? 0 : cursor - x - scale;
}

/** The width a string will take, without drawing it. */
function measureText(text: string, scale: number): number {
  return text.length * GLYPH_ADVANCE * scale - scale;
}

/* ------------------------------------------------------------------ */
/* PNG encoding                                                        */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Encodes the canvas as a truecolor (8 bit RGB) PNG. */
function encodePng(canvas: Canvas): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // colour type: truecolor
  header.writeUInt8(0, 10); // compression
  header.writeUInt8(0, 11); // filter
  header.writeUInt8(0, 12); // interlace

  const stride = canvas.width * 3;
  const raw = Buffer.alloc(canvas.height * (stride + 1));
  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type: none
    canvas.data.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Verification: read the file back and check what we wrote.           */
/* ------------------------------------------------------------------ */

interface DecodedPng {
  width: number;
  height: number;
  pixel: (x: number, y: number) => Rgb | undefined;
}

function decodePng(bytes: Buffer): DecodedPng {
  const signature = bytes.subarray(0, 8);
  if (signature.toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('not a PNG: bad signature');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(body));
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 3;
  const pixel = (x: number, y: number): Rgb | undefined => {
    if (x < 0 || y < 0 || x >= width || y >= height) return undefined;
    const rowStart = y * (stride + 1) + 1 + x * 3;
    return [raw[rowStart], raw[rowStart + 1], raw[rowStart + 2]];
  };
  return { width, height, pixel };
}

function sameColor(a: Rgb | undefined, b: Rgb): boolean {
  return a !== undefined && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

function buildCanvas(): Canvas {
  const canvas = new Canvas(CARD_WIDTH, CARD_HEIGHT);
  canvas.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT, BACKGROUND);
  drawText(canvas, TITLE_TEXT, MARGIN_X, TITLE_TOP, TITLE_SCALE, FOREGROUND);
  canvas.fillRect(MARGIN_X, RULE_TOP, RULE_WIDTH, RULE_HEIGHT, ACCENT);
  drawText(canvas, SUBTITLE_TEXT, MARGIN_X, SUBTITLE_TOP, SUBTITLE_SCALE, MUTED);
  return canvas;
}

function buildSvg(): string {
  const titleHeight = GLYPH_HEIGHT * TITLE_SCALE;
  const titleBaseline = TITLE_TOP + Math.round(titleHeight * 0.78);
  const subtitleHeight = GLYPH_HEIGHT * SUBTITLE_SCALE;
  const subtitleBaseline = SUBTITLE_TOP + Math.round(subtitleHeight * 0.78);
  const titleSize = Math.round(titleHeight * 0.82);
  const subtitleSize = Math.round(subtitleHeight * 0.82);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-labelledby="og-title og-desc">`,
    '  <title id="og-title">Arpit Singh - The Local 3D</title>',
    '  <desc id="og-desc">The social card for arpit singh, a portfolio and project archive.</desc>',
    `  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#000016"/>`,
    `  <text x="${MARGIN_X}" y="${titleBaseline}" font-family="Georgia, serif" font-size="${titleSize}" letter-spacing="${TITLE_SCALE}" fill="#f1f1f1">${TITLE_TEXT}</text>`,
    `  <rect x="${MARGIN_X}" y="${RULE_TOP}" width="${RULE_WIDTH}" height="${RULE_HEIGHT}" fill="#e4032e"/>`,
    `  <text x="${MARGIN_X}" y="${subtitleBaseline}" font-family="Georgia, serif" font-size="${subtitleSize}" letter-spacing="${SUBTITLE_SCALE}" fill="#9797a5">${SUBTITLE_TEXT}</text>`,
    '</svg>',
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = join(root, 'public', 'og');
  const pngPath = join(outDir, 'og.png');
  const svgPath = join(outDir, 'og.svg');

  const canvas = buildCanvas();
  const png = encodePng(canvas);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(pngPath, png);
  writeFileSync(svgPath, buildSvg(), 'utf8');

  const decoded = decodePng(readFileSync(pngPath));
  if (decoded.width !== CARD_WIDTH || decoded.height !== CARD_HEIGHT) {
    throw new Error(
      `IHDR says ${decoded.width}x${decoded.height}, expected ${CARD_WIDTH}x${CARD_HEIGHT}`,
    );
  }

  const checks: Array<{ label: string; x: number; y: number; color: Rgb }> = [
    { label: 'background', x: 4, y: 4, color: BACKGROUND },
    { label: 'title', x: MARGIN_X + TITLE_SCALE, y: TITLE_TOP, color: FOREGROUND },
    { label: 'rule', x: MARGIN_X + 4, y: RULE_TOP + 2, color: ACCENT },
    { label: 'subtitle', x: MARGIN_X, y: SUBTITLE_TOP, color: MUTED },
  ];
  for (const check of checks) {
    if (!sameColor(decoded.pixel(check.x, check.y), check.color)) {
      throw new Error(`verification failed: ${check.label} pixel is not ${check.color.join(',')}`);
    }
  }

  const titleWidth = measureText(TITLE_TEXT, TITLE_SCALE);
  const subtitleWidth = measureText(SUBTITLE_TEXT, SUBTITLE_SCALE);

  console.log(`og.png : ${decoded.width}x${decoded.height} truecolor PNG, ${png.length} bytes`);
  console.log(`og.svg : ${Buffer.byteLength(buildSvg(), 'utf8')} bytes`);
  console.log(
    `layout : title ${titleWidth}px at ${MARGIN_X},${TITLE_TOP} | rule ${RULE_WIDTH}x${RULE_HEIGHT} at ${MARGIN_X},${RULE_TOP} | subtitle ${subtitleWidth}px at ${MARGIN_X},${SUBTITLE_TOP}`,
  );
  console.log(`check  : IHDR and ${checks.length} sampled pixels verified`);
}

main();
