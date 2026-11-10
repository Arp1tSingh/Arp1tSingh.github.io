/**
 * A small, self-contained QR Code encoder.
 *
 * Scope: byte mode (UTF-8 bytes), error correction level M, versions 1 to 10.
 * That is 14 bytes at version 1 up to 213 bytes at version 10, which covers
 * every URL and ticket code this site prints.
 *
 * The encoder follows ISO/IEC 18004:
 *
 *   1. the payload is written as a bit stream (mode indicator, character
 *      count indicator, bytes, terminator, pad codewords),
 *   2. the bit stream is split into Reed-Solomon blocks and each block is
 *      protected with its own error correction codewords,
 *   3. data and error correction codewords are interleaved so that a
 *      horizontal scratch cannot destroy a whole block,
 *   4. the codewords are placed into the module grid in the zig-zag order,
 *      skipping every function pattern,
 *   5. each of the eight data masks is tried and the one with the lowest
 *      penalty score wins.
 *
 * Everything here is plain TypeScript with no dependencies: the arithmetic
 * needs one 256 entry Galois field table and the layout needs one table of
 * version parameters.
 */

/* -------------------------------------------------------------------------- */
/* Galois field GF(2^8)                                                        */
/* -------------------------------------------------------------------------- */

/**
 * GF(2^8) as used by QR Codes: the primitive polynomial is
 * x^8 + x^4 + x^3 + x^2 + 1, which is 0x11D.
 *
 * `GF_EXP[i]` is alpha^i (alpha being the generator 2) and `GF_LOG[v]` is the
 * discrete logarithm of v, so that a multiplication becomes a table lookup:
 * a * b === GF_EXP[GF_LOG[a] + GF_LOG[b]].
 *
 * The exponent table is doubled so that sums up to 510 need no modulo.
 */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

function buildGaloisTables(): void {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
}

buildGaloisTables();

/** Multiply two elements of GF(2^8). */
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/* -------------------------------------------------------------------------- */
/* Version parameters (error correction level M)                                */
/* -------------------------------------------------------------------------- */

/**
 * The block structure of one QR Code version at error correction level M.
 *
 * `totalCodewords` counts data *and* error correction codewords.
 * `blocks` is the number of Reed-Solomon blocks the data is split into.
 * Every block gets `ecPerBlock` error correction codewords.
 * The blocks come in two sizes: `shortBlocks` of them carry `shortData`
 * data codewords, the remaining ones carry one codeword more.
 */
interface VersionSpec {
  readonly totalCodewords: number;
  readonly blocks: number;
  readonly ecPerBlock: number;
  readonly shortBlocks: number;
  readonly shortData: number;
}

/** Versions 1 to 10. Index 0 is version 1. */
const VERSIONS: readonly VersionSpec[] = [
  { totalCodewords: 26, blocks: 1, ecPerBlock: 10, shortBlocks: 1, shortData: 16 },
  { totalCodewords: 44, blocks: 1, ecPerBlock: 16, shortBlocks: 1, shortData: 28 },
  { totalCodewords: 70, blocks: 1, ecPerBlock: 26, shortBlocks: 1, shortData: 44 },
  { totalCodewords: 100, blocks: 2, ecPerBlock: 18, shortBlocks: 2, shortData: 32 },
  { totalCodewords: 134, blocks: 2, ecPerBlock: 24, shortBlocks: 2, shortData: 43 },
  { totalCodewords: 172, blocks: 4, ecPerBlock: 16, shortBlocks: 4, shortData: 27 },
  { totalCodewords: 196, blocks: 4, ecPerBlock: 18, shortBlocks: 4, shortData: 31 },
  { totalCodewords: 242, blocks: 4, ecPerBlock: 22, shortBlocks: 2, shortData: 38 },
  { totalCodewords: 292, blocks: 5, ecPerBlock: 22, shortBlocks: 3, shortData: 36 },
  { totalCodewords: 346, blocks: 5, ecPerBlock: 26, shortBlocks: 4, shortData: 43 },
];

/** Highest version this encoder produces. */
const MAX_VERSION = VERSIONS.length;

/**
 * Centre coordinates of the alignment patterns, one entry per version.
 * Version 1 has none; version 2 to 6 have one row of them; version 7 and up
 * have a 3x3 grid minus the three corners taken by the finder patterns.
 */
const ALIGNMENT_CENTERS: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/**
 * Error correction level M as the two bit pattern the format information
 * carries (ISO/IEC 18004 table 12): L = 01, M = 00, Q = 11, H = 10.
 */
const EC_LEVEL_M_BITS = 0b00;

/* -------------------------------------------------------------------------- */
/* BCH codes for the format and version information                             */
/* -------------------------------------------------------------------------- */

/**
 * Format information: 5 data bits (2 error correction bits + 3 mask bits)
 * protected by a BCH(15, 5) code whose generator is 0x537, then masked with
 * 0x5412 so that the all zero pattern never appears.
 */
function formatBits(ecBits: number, mask: number): number {
  const data = (ecBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

/**
 * Version information (versions 7 and up): 6 data bits protected by a
 * BCH(18, 6) code whose generator is 0x1F25.
 */
function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i += 1) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  }
  return (version << 12) | rem;
}

/* -------------------------------------------------------------------------- */
/* Reed-Solomon                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Generator polynomial for `degree` error correction codewords:
 * (x - a^0)(x - a^1)...(x - a^(degree-1)). In GF(2^8) minus and plus are
 * the same operation, so this is a plain polynomial product.
 * The leading coefficient (index 0) is always 1.
 */
function generatorPolynomial(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j]; // poly[j] * x
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]); // poly[j] * a^i
    }
    poly = next;
  }
  return poly;
}

/**
 * The error correction codewords of one block: the remainder of the block
 * data multiplied by x^degree, divided by the generator polynomial.
 *
 * `remainder` always holds `degree` coefficients, the first one being the
 * highest, which is why the leading coefficient of the generator can be
 * skipped in the inner loop.
 */
function reedSolomon(data: readonly number[], degree: number): number[] {
  const generator = generatorPolynomial(degree);
  const remainder = new Array<number>(degree).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < degree; i += 1) {
      remainder[i] ^= gfMul(generator[i + 1], factor);
    }
  }

  return remainder;
}

/* -------------------------------------------------------------------------- */
/* Bit stream                                                                   */
/* -------------------------------------------------------------------------- */

/** Pack a bit array (most significant bit first) into codewords. */
function packBits(bits: readonly boolean[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      if (bits[i + j]) byte |= 1 << (7 - j);
    }
    bytes.push(byte);
  }
  return bytes;
}

/**
 * The bit stream of one byte mode segment:
 *
 *   mode indicator (0100) | character count | payload bytes |
 *   terminator (up to four zero bits) | zero padding to a byte |
 *   pad codewords 0xEC, 0x11, 0xEC, ...
 */
function buildDataBits(bytes: Uint8Array, version: number): boolean[] {
  const spec = VERSIONS[version - 1];
  const dataCodewords = spec.totalCodewords - spec.blocks * spec.ecPerBlock;
  const capacityBits = dataCodewords * 8;

  // The character count indicator is 8 bits wide up to version 9 and 16 bits
  // wide from version 10 on.
  const countBits = version < 10 ? 8 : 16;

  const bits: boolean[] = [];
  const push = (value: number, length: number): void => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push(((value >>> i) & 1) === 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, countBits);
  for (const byte of bytes) push(byte, 8);

  // Terminator, shortened when the payload fills the symbol exactly.
  push(0, Math.min(4, capacityBits - bits.length));

  // Pad to a whole codeword.
  while (bits.length % 8 !== 0) bits.push(false);

  // Fill the rest with the two alternating pad codewords.
  let pad = 0;
  while (bits.length < capacityBits) {
    push(pad % 2 === 0 ? 0xec : 0x11, 8);
    pad += 1;
  }

  return bits;
}

/* -------------------------------------------------------------------------- */
/* Codewords                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The final codeword sequence: the data codewords split into Reed-Solomon
 * blocks, each block protected, and everything interleaved.
 *
 * Interleaving order: take codeword 0 of every block in turn, then codeword 1
 * of every block, and so on; after the data codewords come the error
 * correction codewords in the same order. A decoder therefore rebuilds the
 * blocks by taking every n-th codeword, and a scratch that damages one
 * codeword of each block damages all blocks a little instead of one a lot.
 */
function buildCodewords(bytes: Uint8Array, version: number): number[] {
  const spec = VERSIONS[version - 1];
  const dataCodewords = packBits(buildDataBits(bytes, version));

  // Split the data into blocks. The first blocks are the short ones.
  const blocks: number[][] = [];
  let offset = 0;
  for (let block = 0; block < spec.blocks; block += 1) {
    const size = block < spec.shortBlocks ? spec.shortData : spec.shortData + 1;
    blocks.push(dataCodewords.slice(offset, offset + size));
    offset += size;
  }

  // Every block gets its own error correction codewords.
  const parity = blocks.map((block) => reedSolomon(block, spec.ecPerBlock));

  // Interleave.
  const interleaved: number[] = [];
  const longest = spec.shortData + 1;
  for (let i = 0; i < longest; i += 1) {
    for (const block of blocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const block of parity) {
      interleaved.push(block[i]);
    }
  }

  return interleaved;
}

/* -------------------------------------------------------------------------- */
/* Matrix                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The module grid. `modules` holds the colour of every module, `reserved`
 * marks the function patterns (finder, separator, timing, alignment, format
 * and version information). Reserved modules never carry data and are never
 * masked.
 */
interface Canvas {
  readonly size: number;
  readonly modules: boolean[][];
  readonly reserved: boolean[][];
}

function createCanvas(size: number): Canvas {
  const modules: boolean[][] = [];
  const reserved: boolean[][] = [];
  for (let row = 0; row < size; row += 1) {
    modules.push(new Array<boolean>(size).fill(false));
    reserved.push(new Array<boolean>(size).fill(false));
  }
  return { size, modules, reserved };
}

/** Write a function pattern module and mark it as reserved. */
function setModule(canvas: Canvas, row: number, col: number, dark: boolean): void {
  canvas.modules[row][col] = dark;
  canvas.reserved[row][col] = true;
}

/**
 * The three finder patterns with their one module wide separators. The
 * pattern is a 7x7 square: a dark border, a light ring and a dark 3x3 core.
 */
function placeFinderPatterns(canvas: Canvas): void {
  const { size } = canvas;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];

  for (const [top, left] of corners) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const onRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(canvas, row, col, onRing || inCore);
      }
    }
  }
}

/** The horizontal and vertical timing patterns: alternating dark and light. */
function placeTimingPatterns(canvas: Canvas): void {
  for (let i = 8; i < canvas.size - 8; i += 1) {
    const dark = i % 2 === 0;
    setModule(canvas, i, 6, dark);
    setModule(canvas, 6, i, dark);
  }
}

/** The alignment patterns, a dark ring around a dark centre. */
function placeAlignmentPatterns(canvas: Canvas, version: number): void {
  const centers = ALIGNMENT_CENTERS[version - 1];
  const last = canvas.size - 7;

  for (const row of centers) {
    for (const col of centers) {
      // The three corners of the grid are taken by the finder patterns.
      if ((row === 6 && col === 6) || (row === 6 && col === last) || (row === last && col === 6)) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const dark = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
          setModule(canvas, row + r, col + c, dark);
        }
      }
    }
  }
}

/**
 * The format information, written twice: once around the top left finder
 * pattern and once split between the top right and the bottom left finder
 * pattern. Bit 0 is the least significant bit of the BCH codeword.
 */
function placeFormatInfo(canvas: Canvas, mask: number): void {
  const { size } = canvas;
  const bits = formatBits(EC_LEVEL_M_BITS, mask);

  for (let i = 0; i < 15; i += 1) {
    const dark = ((bits >>> i) & 1) === 1;

    // First copy, next to the top left finder pattern.
    if (i < 6) setModule(canvas, i, 8, dark);
    else if (i < 8) setModule(canvas, i + 1, 8, dark);
    else setModule(canvas, size - 15 + i, 8, dark);

    // Second copy, along the top right and bottom left finder patterns.
    if (i < 8) setModule(canvas, 8, size - i - 1, dark);
    else if (i < 9) setModule(canvas, 8, 15 - i, dark);
    else setModule(canvas, 8, 15 - i - 1, dark);
  }

  // The module below the top left format information is always dark.
  setModule(canvas, size - 8, 8, true);
}

/** The version information, versions 7 and up only, in both bottom left and top right. */
function placeVersionInfo(canvas: Canvas, version: number): void {
  const { size } = canvas;
  const bits = versionBits(version);

  for (let i = 0; i < 18; i += 1) {
    const row = Math.floor(i / 3);
    const col = (i % 3) + size - 11;
    const dark = ((bits >>> i) & 1) === 1;
    setModule(canvas, row, col, dark);
    setModule(canvas, col, row, dark);
  }
}

/**
 * Place the codewords into the grid.
 *
 * The data travels in two module wide columns from the bottom right corner to
 * the top left, alternating upwards and downwards. The vertical timing
 * pattern column 6 is skipped, and reserved modules are stepped over without
 * consuming a bit of the codeword stream.
 */
function placeData(canvas: Canvas, codewords: readonly number[]): void {
  const { size } = canvas;
  let byteIndex = 0;
  let bitIndex = 0;
  let row = size - 1;
  let direction = -1;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;

    for (;;) {
      for (let c = 0; c < 2; c += 1) {
        const target = col - c;
        if (canvas.reserved[row][target]) continue;

        let dark = false;
        if (byteIndex < codewords.length) {
          dark = ((codewords[byteIndex] >>> (7 - bitIndex)) & 1) === 1;
        }
        canvas.modules[row][target] = dark;

        bitIndex += 1;
        if (bitIndex === 8) {
          bitIndex = 0;
          byteIndex += 1;
        }
      }

      row += direction;
      if (row < 0 || row >= size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Data masks                                                                   */
/* -------------------------------------------------------------------------- */

/** The eight standard mask patterns, as functions of the module position. */
function maskAt(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row * col) % 3) + ((row + col) % 2)) % 2 === 0;
  }
}

/** Flip every data module that the mask pattern covers. */
function applyMask(canvas: Canvas, mask: number): void {
  for (let row = 0; row < canvas.size; row += 1) {
    for (let col = 0; col < canvas.size; col += 1) {
      if (canvas.reserved[row][col]) continue;
      if (maskAt(mask, row, col)) canvas.modules[row][col] = !canvas.modules[row][col];
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Penalty scoring                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The four penalty rules of ISO/IEC 18004 section 7.8.3. A symbol is easier
 * to scan when it scores low, so the mask with the smallest total wins.
 */

/**
 * Rule 1: runs of five or more modules of the same colour in a row or a
 * column cost 3 points plus 1 point per module beyond the fifth.
 */
function penaltyRule1(canvas: Canvas): number {
  const { size, modules } = canvas;
  let points = 0;

  for (let line = 0; line < size; line += 1) {
    // The row.
    let run = 1;
    for (let col = 1; col < size; col += 1) {
      if (modules[line][col] === modules[line][col - 1]) {
        run += 1;
      } else {
        if (run >= 5) points += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) points += 3 + (run - 5);

    // The column.
    run = 1;
    for (let row = 1; row < size; row += 1) {
      if (modules[row][line] === modules[row - 1][line]) {
        run += 1;
      } else {
        if (run >= 5) points += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) points += 3 + (run - 5);
  }

  return points;
}

/** Rule 2: every 2x2 block of one colour costs 3 points. */
function penaltyRule2(canvas: Canvas): number {
  const { size, modules } = canvas;
  let points = 0;

  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const first = modules[row][col];
      if (first === modules[row][col + 1] && first === modules[row + 1][col] && first === modules[row + 1][col + 1]) {
        points += 3;
      }
    }
  }

  return points;
}

/**
 * Rule 3: a finder like pattern (dark light dark dark dark light dark) that
 * is preceded or followed by four light modules looks like a second finder
 * pattern to a scanner and costs 40 points.
 *
 * Both eleven module shapes are looked for in every row and every column.
 */
function penaltyRule3(canvas: Canvas): number {
  const { size, modules } = canvas;
  const PATTERN_AFTER = 0b10111010000; // 1:1:3:1:1 pattern, then four light modules
  const PATTERN_BEFORE = 0b00001011101; // four light modules, then the 1:1:3:1:1 pattern
  let points = 0;

  for (let line = 0; line < size; line += 1) {
    let window = 0;
    for (let col = 0; col < size; col += 1) {
      window = ((window << 1) & 0x7ff) | (modules[line][col] ? 1 : 0);
      if (col >= 10 && (window === PATTERN_AFTER || window === PATTERN_BEFORE)) points += 1;
    }

    window = 0;
    for (let row = 0; row < size; row += 1) {
      window = ((window << 1) & 0x7ff) | (modules[row][line] ? 1 : 0);
      if (row >= 10 && (window === PATTERN_AFTER || window === PATTERN_BEFORE)) points += 1;
    }
  }

  return points * 40;
}

/**
 * Rule 4: a symbol that is not roughly half dark is hard to read. The dark
 * module percentage is rounded up to the next multiple of five, and every
 * step of five away from fifty percent costs 10 points.
 */
function penaltyRule4(canvas: Canvas): number {
  const { size, modules } = canvas;
  let dark = 0;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules[row][col]) dark += 1;
    }
  }

  const percent = (dark * 100) / (size * size);
  const steps = Math.abs(Math.ceil(percent / 5) - 10);

  return steps * 10;
}

/** The total penalty of the current symbol. */
function penaltyScore(canvas: Canvas): number {
  return penaltyRule1(canvas) + penaltyRule2(canvas) + penaltyRule3(canvas) + penaltyRule4(canvas);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The smallest version that can hold `byteCount` bytes at error correction
 * level M, or an error when the payload is too long.
 */
function chooseVersion(byteCount: number): number {
  for (let version = 1; version <= MAX_VERSION; version += 1) {
    const spec = VERSIONS[version - 1];
    const dataCodewords = spec.totalCodewords - spec.blocks * spec.ecPerBlock;
    const capacityBits = dataCodewords * 8;
    // Mode indicator plus character count indicator.
    const headerBits = 4 + (version < 10 ? 8 : 16);
    if (headerBits + byteCount * 8 <= capacityBits) return version;
  }

  const last = VERSIONS[MAX_VERSION - 1];
  const maxBytes = Math.floor(((last.totalCodewords - last.blocks * last.ecPerBlock) * 8 - 20) / 8);
  throw new Error(
    `qrMatrix: ${byteCount} bytes does not fit in a version ${MAX_VERSION} QR code ` +
      `(the limit is ${maxBytes} bytes at error correction level M).`,
  );
}

/**
 * Encode `text` as a QR Code matrix.
 * Returns rows of modules; `true` is a dark module and `false` is light.
 * The result includes NO quiet zone - the caller adds it.
 */
export function qrMatrix(text: string): boolean[][] {
  // Byte mode carries the text as UTF-8 bytes; the character count
  // indicator counts those bytes, not the characters.
  const bytes = new TextEncoder().encode(text);

  const version = chooseVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);

  const size = 17 + 4 * version;
  const canvas = createCanvas(size);

  // Function patterns first, so that the data placement can skip them.
  placeFinderPatterns(canvas);
  placeTimingPatterns(canvas);
  placeAlignmentPatterns(canvas, version);
  // The format information is written twice: once with a placeholder to
  // reserve the modules, then for real once the mask is known.
  placeFormatInfo(canvas, 0);
  if (version >= 7) placeVersionInfo(canvas, version);

  placeData(canvas, codewords);

  // Try every mask and keep the one with the lowest penalty. The format
  // information is part of the symbol, so it is rewritten for every mask
  // before that mask is scored.
  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask += 1) {
    placeFormatInfo(canvas, mask);
    applyMask(canvas, mask);
    const penalty = penaltyScore(canvas);
    applyMask(canvas, mask); // undo
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
  }

  applyMask(canvas, bestMask);
  placeFormatInfo(canvas, bestMask);

  return canvas.modules;
}
