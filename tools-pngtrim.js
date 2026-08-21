// Minimal PNG reader/writer, just enough to trim the uniform border off the
// cover artwork. Handles 8-bit RGB / RGBA, non-interlaced — which is what the
// asset is.
const fs = require('fs');
const zlib = require('zlib');

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = buf => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function readChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off += 12 + len;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decode(file) {
  const chunks = readChunks(fs.readFileSync(file));
  const ihdr = chunks.find(c => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const colorType = ihdr[9];
  if (depth !== 8) throw new Error('only 8-bit supported, got ' + depth);
  if (ihdr[12] !== 0) throw new Error('interlaced PNGs not supported');
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : null;
  if (!bpp) throw new Error('unsupported colorType ' + colorType);

  const raw = zlib.inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[i] = v & 0xff;
    }
  }
  return { width, height, bpp, colorType, pixels: out };
}

function encode(file, { width, height, bpp, colorType, pixels }) {
  const stride = width * bpp;
  const raw = Buffer.alloc(height * (stride + 1));

  // Adaptive filtering. Writing every row unfiltered is valid but compresses
  // badly on photographic content — it made the trimmed cover larger than the
  // untrimmed source. Pick the filter with the smallest sum of absolute
  // signed deviations per row, which is the heuristic libpng uses.
  const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < height; y++) {
    const cur = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;

    let best = 0, bestScore = Infinity;
    for (let f = 0; f <= 4; f++) {
      const buf = cand[f];
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0;
        const b = prev ? prev[i] : 0;
        const c = prev && i >= bpp ? prev[i - bpp] : 0;
        let v;
        if (f === 0) v = cur[i];
        else if (f === 1) v = cur[i] - a;
        else if (f === 2) v = cur[i] - b;
        else if (f === 3) v = cur[i] - ((a + b) >> 1);
        else v = cur[i] - paeth(a, b, c);
        v &= 0xff;
        buf[i] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) { bestScore = score; best = f; }
    }

    raw[y * (stride + 1)] = best;
    cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = colorType; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
    return Buffer.concat([len, td, crc]);
  };

  fs.writeFileSync(file, Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

// --- trim -------------------------------------------------------------
const src = process.argv[2];
const dst = process.argv[3];
const TOL = Number(process.argv[4] || 6);

const img = decode(src);
const { width, height, bpp, pixels } = img;
const at = (x, y) => pixels.readUInt8(y * width * bpp + x * bpp);
const px = (x, y) => {
  const o = y * width * bpp + x * bpp;
  return [pixels[o], pixels[o + 1], pixels[o + 2]];
};
const ref = px(0, 0);
const isBorder = (x, y) => {
  const p = px(x, y);
  return Math.abs(p[0] - ref[0]) <= TOL && Math.abs(p[1] - ref[1]) <= TOL && Math.abs(p[2] - ref[2]) <= TOL;
};
const rowIsBorder = y => { for (let x = 0; x < width; x++) if (!isBorder(x, y)) return false; return true; };
const colIsBorder = x => { for (let y = 0; y < height; y++) if (!isBorder(x, y)) return false; return true; };

let top = 0; while (top < height && rowIsBorder(top)) top++;
let bottom = height - 1; while (bottom > top && rowIsBorder(bottom)) bottom--;
let left = 0; while (left < width && colIsBorder(left)) left++;
let right = width - 1; while (right > left && colIsBorder(right)) right--;

const nw = right - left + 1;
const nh = bottom - top + 1;
console.log('source      : ' + width + 'x' + height + '  corner rgb(' + ref.join(',') + ')');
console.log('border trim : top ' + top + '  bottom ' + (height - 1 - bottom) + '  left ' + left + '  right ' + (width - 1 - right));
console.log('trimmed     : ' + nw + 'x' + nh + '  aspect ' + (nw / nh).toFixed(4));

if (!dst) process.exit(0);

const cropped = Buffer.alloc(nh * nw * bpp);
for (let y = 0; y < nh; y++) {
  pixels.copy(cropped, y * nw * bpp, (top + y) * width * bpp + left * bpp, (top + y) * width * bpp + (left + nw) * bpp);
}
encode(dst, { width: nw, height: nh, bpp, colorType: img.colorType, pixels: cropped });
console.log('written     : ' + dst + '  ' + (fs.statSync(dst).size / 1024).toFixed(0) + ' KB');
