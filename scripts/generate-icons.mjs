/* Genera todos los iconos que necesitan la PWA y Google Play.

   Uso:
     node scripts/generate-icons.mjs

   Si existe  brand/icon-source.png  (tu icono real, cuadrado y cuanto más
   grande mejor), genera todos los tamaños a partir de él.
   Si no existe, dibuja una versión provisional con la paleta de marca.

   Sin dependencias: el PNG se lee y se escribe a mano (zlib viene con Node). */

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const BRAND = {
  bg: [0xff, 0xff, 0xff],     // fondo blanco, como el icono
  globe: [0x1c, 0xa6, 0xa6],  // turquesa
  ring: [0x0b, 0x22, 0x39],   // azul petróleo
  dot: [0xff, 0x5a, 0x3c],    // coral
};

const SOURCE = path.join(process.cwd(), "brand", "icon-source.png");
const OUT_DIR = path.join(process.cwd(), "public", "icons");

/* ============ PNG: escritura ============ */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};
function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ============ PNG: lectura ============ */
function decodePNG(buf) {
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("No es un PNG.");
  let p = 8, ihdr = null, idat = [], plte = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.subarray(p + 4, p + 8).toString("ascii");
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    else if (type === "IDAT") idat.push(data);
    else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (!ihdr) throw new Error("PNG sin cabecera IHDR.");
  if (ihdr.depth !== 8) throw new Error(`Profundidad ${ihdr.depth} no soportada: vuelve a exportar el PNG a 8 bits por canal.`);
  if (ihdr.interlace) throw new Error("PNG entrelazado (Adam7) no soportado: exporta sin entrelazado.");

  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  if (!CH) throw new Error(`Tipo de color ${ihdr.color} no soportado.`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr;
  const stride = w * CH;
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.from(line);
    for (let i = 0; i < stride; i++) {
      const a = i >= CH ? cur[i - CH] : 0;
      const b = prev[i];
      const c = i >= CH ? prev[i - CH] : 0;
      let v = cur[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }

  // a RGBA
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    const s = i * CH, d = i * 4;
    if (ihdr.color === 6) { out.copy(rgba, d, s, s + 4); }
    else if (ihdr.color === 2) { rgba[d] = out[s]; rgba[d + 1] = out[s + 1]; rgba[d + 2] = out[s + 2]; rgba[d + 3] = 255; }
    else if (ihdr.color === 0) { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = 255; }
    else if (ihdr.color === 4) { rgba[d] = rgba[d + 1] = rgba[d + 2] = out[s]; rgba[d + 3] = out[s + 1]; }
    else if (ihdr.color === 3) {
      const idx = out[s];
      rgba[d] = plte[idx * 3]; rgba[d + 1] = plte[idx * 3 + 1]; rgba[d + 2] = plte[idx * 3 + 2];
      rgba[d + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { w, h, rgba };
}

/* Reescalado por promedio de área: es el que mejor aguanta reducciones grandes
   (1024 -> 48) sin que el dibujo se vuelva ruido. Premultiplica el alfa. */
function resize(src, tw, th) {
  const { w: sw, h: sh, rgba } = src;
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const y0 = (y * sh) / th, y1 = ((y + 1) * sh) / th;
    for (let x = 0; x < tw; x++) {
      const x0 = (x * sw) / tw, x1 = ((x + 1) * sw) / tw;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = Math.floor(y0); sy < Math.min(sh, Math.ceil(y1)); sy++) {
        for (let sx = Math.floor(x0); sx < Math.min(sw, Math.ceil(x1)); sx++) {
          const o = (sy * sw + sx) * 4, al = rgba[o + 3] / 255;
          r += rgba[o] * al; g += rgba[o + 1] * al; b += rgba[o + 2] * al; a += al; n++;
        }
      }
      const d = (y * tw + x) * 4;
      if (!n || a === 0) { out[d] = out[d + 1] = out[d + 2] = out[d + 3] = 0; continue; }
      out[d] = Math.round(r / a); out[d + 1] = Math.round(g / a); out[d + 2] = Math.round(b / a);
      out[d + 3] = Math.round((a / n) * 255);
    }
  }
  return { w: tw, h: th, rgba: out };
}

/* Aplana sobre un fondo opaco: Play y los iconos "maskable" no admiten
   transparencia (se vería un recorte negro en algunos móviles). */
function flatten(img, bg) {
  const { w, h, rgba } = img;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i * 4, a = rgba[o + 3] / 255;
    out[o] = Math.round(rgba[o] * a + bg[0] * (1 - a));
    out[o + 1] = Math.round(rgba[o + 1] * a + bg[1] * (1 - a));
    out[o + 2] = Math.round(rgba[o + 2] * a + bg[2] * (1 - a));
    out[o + 3] = 255;
  }
  return { w, h, rgba: out };
}

/* ============ dibujo provisional (solo si no hay icono real) ============ */
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
function drawPlaceholder(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3, c = size / 2;
  const rGlobe = size * 0.235;
  const rRing = size * 0.375, wRing = size * 0.031;
  const dotA = Math.PI * 0.78, rDot = size * 0.052;
  const dotX = c + Math.cos(dotA) * rRing, dotY = c + Math.sin(dotA) * rRing;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let globe = 0, ring = 0, dot = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS - c, y = py + (sy + 0.5) / SS - c;
          const d = Math.hypot(x, y);
          if (d <= rGlobe) globe++;
          if (Math.abs(d - rRing) <= wRing / 2) {
            // dos huecos en la órbita, como en el icono
            let ang = Math.atan2(y, x); if (ang < 0) ang += Math.PI * 2;
            const inGap = (ang > 5.55 || ang < 0.35) || (ang > 2.45 && ang < 2.95);
            if (!inGap) ring++;
          }
          if (Math.hypot(px + (sx + 0.5) / SS - dotX, py + (sy + 0.5) / SS - dotY) <= rDot) dot++;
        }
      }
      const t = SS * SS;
      let col = BRAND.bg.slice();
      if (globe) col = mix(col, BRAND.globe, globe / t);
      if (ring) col = mix(col, BRAND.ring, ring / t);
      if (dot) col = mix(col, BRAND.dot, dot / t);
      const o = (py * size + px) * 4;
      rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; rgba[o + 3] = 255;
    }
  }
  return { w: size, h: size, rgba };
}

/* ============ salida ============ */
fs.mkdirSync(OUT_DIR, { recursive: true });

let source = null;
if (fs.existsSync(SOURCE)) {
  source = decodePNG(fs.readFileSync(SOURCE));
  if (source.w !== source.h) {
    console.warn(`⚠ El icono no es cuadrado (${source.w}×${source.h}); se deformará. Recórtalo cuadrado.`);
  }
  console.log(`Usando tu icono: brand/icon-source.png (${source.w}×${source.h})\n`);
} else {
  console.log("No hay brand/icon-source.png — se generan iconos PROVISIONALES.");
  console.log("Guarda ahí tu icono en PNG y vuelve a ejecutar este comando.\n");
}

const TARGETS = [
  ["icon-192.png", 192], ["icon-512.png", 512],
  ["icon-maskable-192.png", 192], ["icon-maskable-512.png", 512],
  ["apple-touch-icon.png", 180], ["favicon-32.png", 32],
];

for (const [name, size] of TARGETS) {
  const img = source ? resize(source, size, size) : drawPlaceholder(size);
  const buf = encodePNG(size, size, flatten(img, BRAND.bg).rgba);
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log(`✓ public/icons/${name}  (${size}×${size}, ${(buf.length / 1024).toFixed(1)} KB)`);
}
console.log("\nicon-512.png es el que sube a Google Play.");
