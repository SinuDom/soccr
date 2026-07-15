// Generates PWA icons (192 and 512 PNG) from raw pixel data using Node built-ins.
// Draws a dark rounded-corner background with a white soccer-style disc + orange flame accent.
// Run with: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'public');
mkdirSync(outDir, { recursive: true });

const BG = [0x0b, 0x0f, 0x14];
const DISC = [0xf5, 0xf5, 0xf5];
const DARK = [0x0b, 0x0f, 0x14];
const FLAME = [0xff, 0x8a, 0x1f];

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, pixels /* Uint8Array RGB */) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    pixels.subarray(y * width * 3, (y + 1) * width * 3).copy(raw, y * (1 + width * 3) + 1);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 3);
  const cx = size / 2, cy = size / 2;
  const radius = size * 0.4;
  const cornerR = size * 0.22;

  function setPx(x, y, rgb) {
    const i = (y * size + x) * 3;
    buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2];
  }
  function inRoundedRect(x, y) {
    const r = cornerR;
    if (x >= r && x <= size - r) return true;
    if (y >= r && y <= size - r) return true;
    const cxs = [r, size - r, r, size - r];
    const cys = [r, r, size - r, size - r];
    const px = [x < r, x > size - r, x < r, x > size - r];
    const py = [y < r, y < r, y > size - r, y > size - r];
    for (let k = 0; k < 4; k++) {
      if (px[k] && py[k]) {
        const dx = x - cxs[k], dy = y - cys[k];
        return dx * dx + dy * dy <= r * r;
      }
    }
    return false;
  }

  // Background (rounded corners transparent-ish → fall back to dark for solid PNG)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPx(x, y, inRoundedRect(x, y) ? BG : BG);
    }
  }

  // White disc
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) setPx(x, y, DISC);
    }
  }

  // Dark pentagon accents in classic pattern (rough 5 blobs)
  const pentSize = size * 0.11;
  const pentPositions = [
    [cx, cy - radius * 0.55],
    [cx - radius * 0.55, cy - radius * 0.15],
    [cx + radius * 0.55, cy - radius * 0.15],
    [cx - radius * 0.35, cy + radius * 0.45],
    [cx + radius * 0.35, cy + radius * 0.45],
  ];
  for (const [px, py] of pentPositions) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - px, dy = y - py;
        if (dx * dx + dy * dy <= pentSize * pentSize) {
          const dxc = x - cx, dyc = y - cy;
          if (dxc * dxc + dyc * dyc <= radius * radius) setPx(x, y, DARK);
        }
      }
    }
  }

  // Flame accent bottom-right
  const flameCx = size * 0.82;
  const flameCy = size * 0.82;
  const flameR = size * 0.11;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - flameCx, dy = y - flameCy;
      if (dx * dx + dy * dy <= flameR * flameR) setPx(x, y, FLAME);
    }
  }

  return buf;
}

for (const size of [192, 512]) {
  const png = encodePNG(size, size, drawIcon(size));
  const out = path.join(outDir, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
