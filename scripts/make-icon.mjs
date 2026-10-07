// Erzeugt das flou-Logo aus einer einzigen Geometrie-Beschreibung:
//   brand/flou-icon.svg        – Master-Icon (1024 px, macOS-Raster mit Schatten)
//   src/assets/logo.svg        – Kachel ohne Rand/Schatten für die App-Oberfläche
//   src-tauri/icons/source.png – 1024×1024 PNG mit Transparenz für `tauri icon`
// Ohne externe Abhängigkeiten. Aufruf: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ---------- Geometrie (Kachel-Einheiten 0..128) ----------
const TILE_RADIUS = 28.5;
const LINES = [24, 44, 64, 84, 104];
const LINE_X0 = 16;
const LINE_X1 = 112;
const LINE_WIDTH = 3;
const WORD_DX = 1.17; // Schriftzug horizontal zentriert; die Grundlinie liegt auf der vierten Linie
const WORDMARK =
  'M32.848 50.736V57H40.048V60.36H32.848V81H29.488V60.36H26.2V57H29.488V50.736C29.488 49.568 29.768 48.512 30.328 47.568C30.904 46.608 31.672 45.848 32.632 45.288C33.592 44.712 34.656 44.424 35.824 44.424C36.672 44.424 37.488 44.592 38.272 44.928C39.072 45.264 39.784 45.76 40.408 46.416L38.008 48.792C37.752 48.472 37.424 48.224 37.024 48.048C36.64 47.872 36.24 47.784 35.824 47.784C35.008 47.784 34.304 48.072 33.712 48.648C33.136 49.224 32.848 49.92 32.848 50.736Z' +
  'M44.1456 81V45H47.5056V81H44.1456Z' +
  'M63.6588 81.624C61.4508 81.624 59.4348 81.056 57.6108 79.92C55.8028 78.784 54.3548 77.264 53.2668 75.36C52.1948 73.44 51.6588 71.32 51.6588 69C51.6588 67.24 51.9708 65.6 52.5948 64.08C53.2188 62.544 54.0748 61.2 55.1628 60.048C56.2668 58.88 57.5468 57.968 59.0028 57.312C60.4588 56.656 62.0108 56.328 63.6588 56.328C65.8668 56.328 67.8748 56.896 69.6828 58.032C71.5068 59.168 72.9548 60.696 74.0268 62.616C75.1148 64.536 75.6588 66.664 75.6588 69C75.6588 70.744 75.3468 72.376 74.7228 73.896C74.0988 75.416 73.2348 76.76 72.1308 77.928C71.0428 79.08 69.7708 79.984 68.3148 80.64C66.8748 81.296 65.3228 81.624 63.6588 81.624Z' +
  'M63.6588 78.264C65.2908 78.264 66.7548 77.84 68.0508 76.992C69.3628 76.128 70.3948 74.992 71.1468 73.584C71.9148 72.176 72.2988 70.648 72.2988 69C72.2988 67.32 71.9148 65.776 71.1468 64.368C70.3788 62.944 69.3388 61.808 68.0268 60.96C66.7308 60.112 65.2748 59.688 63.6588 59.688C62.0268 59.688 60.5548 60.12 59.2428 60.984C57.9468 61.832 56.9148 62.96 56.1468 64.368C55.3948 65.776 55.0188 67.32 55.0188 69C55.0188 70.728 55.4108 72.296 56.1948 73.704C56.9788 75.096 58.0268 76.208 59.3388 77.04C60.6508 77.856 62.0908 78.264 63.6588 78.264Z' +
  'M78.5294 71.808V57H81.8894V71.136C81.8894 72.448 82.2094 73.64 82.8494 74.712C83.4894 75.784 84.3454 76.64 85.4174 77.28C86.5054 77.92 87.6974 78.24 88.9934 78.24C90.3054 78.24 91.4894 77.92 92.5454 77.28C93.6174 76.64 94.4734 75.784 95.1134 74.712C95.7534 73.64 96.0734 72.448 96.0734 71.136V57H99.4334L99.4574 81H96.0974L96.0734 77.64C95.2254 78.856 94.1214 79.824 92.7614 80.544C91.4174 81.264 89.9454 81.624 88.3454 81.624C86.5374 81.624 84.8894 81.184 83.4014 80.304C81.9134 79.424 80.7294 78.24 79.8494 76.752C78.9694 75.264 78.5294 73.616 78.5294 71.808Z';
// Eselsohr oben rechts: Rechteck ab x=90 bis y=38 mit gerundeter Innenecke
const FOLD = { x: 90, y: 38, r: 12, stroke: 2.5, shadowDx: -1.5, shadowDy: 2 };

const COLORS = {
  paperTop: '#ffffff',
  paperBottom: '#f3f1ec',
  line: '#ece9e3',
  word: '#4a4946',
  foldLight: '#f2efea',
  foldDark: '#e2ded6',
  foldStroke: '#c9c4ba',
};

// ---------- SVG ----------
const foldPath = `M140 -12V${FOLD.y}H${FOLD.x + FOLD.r}A${FOLD.r} ${FOLD.r} 0 0 1 ${FOLD.x} ${FOLD.y - FOLD.r}V-12Z`;

function tileSvg({ shadow }) {
  const lines = LINES.map(
    (y) => `<path d="M${LINE_X0} ${y}H${LINE_X1}" stroke="${COLORS.line}" stroke-width="${LINE_WIDTH}" stroke-linecap="round"/>`,
  ).join('\n      ');
  return `<defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="128" gradientUnits="userSpaceOnUse">
      <stop stop-color="${COLORS.paperTop}"/><stop offset="1" stop-color="${COLORS.paperBottom}"/>
    </linearGradient>
    <linearGradient id="fold" x1="128" y1="0" x2="90" y2="38" gradientUnits="userSpaceOnUse">
      <stop stop-color="${COLORS.foldLight}"/><stop offset="1" stop-color="${COLORS.foldDark}"/>
    </linearGradient>
    <clipPath id="tile"><rect width="128" height="128" rx="${TILE_RADIUS}"/></clipPath>
    <filter id="foldShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>${
      shadow
        ? `
    <filter id="tileShadow" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="0.8"/></filter>`
        : ''
    }
  </defs>${
    shadow
      ? `
  <rect y="1.55" width="128" height="128" rx="${TILE_RADIUS}" fill="#000" fill-opacity="0.3" filter="url(#tileShadow)"/>`
      : ''
  }
  <rect width="128" height="128" rx="${TILE_RADIUS}" fill="url(#paper)"/>
  <g clip-path="url(#tile)">
      ${lines}
      <path transform="translate(${WORD_DX} 0)" fill="${COLORS.word}" d="${WORDMARK}"/>
      <path transform="translate(${FOLD.shadowDx} ${FOLD.shadowDy})" d="${foldPath}" fill="#000" fill-opacity="0.12" filter="url(#foldShadow)"/>
      <path d="${foldPath}" fill="url(#fold)" stroke="${COLORS.foldStroke}" stroke-width="${FOLD.stroke}"/>
  </g>
  <rect x="0.4" y="0.4" width="127.2" height="127.2" rx="${TILE_RADIUS - 0.4}" fill="none" stroke="#000" stroke-opacity="0.07" stroke-width="0.8"/>`;
}

const iconSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
<g transform="translate(100 100) scale(6.4375)">
  ${tileSvg({ shadow: true })}
</g>
</svg>
`;
const logoSvg = `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${tileSvg({ shadow: false })}
</svg>
`;

// ---------- Rasterisierung ----------
const SIZE = 1024;
const SS = 4; // 4×4 Supersampling
const SCALE = 824 / 128; // macOS-Raster: 824-px-Kachel mit 100 px Rand
const OFFSET = 100;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, hex(v)]));

function roundedRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
const tileSdf = (u, v) => roundedRect(u, v, 64, 64, 64, 64, TILE_RADIUS);
// Eselsohr als großes gerundetes Rechteck, dessen einzige sichtbare Ecke die Innenecke ist
const foldSdf = (u, v) => roundedRect(u, v, FOLD.x + 50, FOLD.y - 50, 50, 50, FOLD.r);

/** Zerlegt einen absoluten SVG-Pfad (M, L, H, V, C, Z) in Polygone. */
function pathToPolygons(d, dx) {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  const polys = [];
  let poly = null;
  let x = 0;
  let y = 0;
  let i = 0;
  let cmd = '';
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M') {
      x = num(); y = num();
      poly = [[x + dx, y]];
      polys.push(poly);
      cmd = 'L';
    } else if (cmd === 'L') {
      x = num(); y = num();
      poly.push([x + dx, y]);
    } else if (cmd === 'H') {
      x = num();
      poly.push([x + dx, y]);
    } else if (cmd === 'V') {
      y = num();
      poly.push([x + dx, y]);
    } else if (cmd === 'C') {
      const [x1, y1, x2, y2, x3, y3] = [num(), num(), num(), num(), num(), num()];
      for (let s = 1; s <= 12; s++) {
        const t = s / 12;
        const mt = 1 - t;
        const px = mt ** 3 * x + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t ** 3 * x3;
        const py = mt ** 3 * y + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t ** 3 * y3;
        poly.push([px + dx, py]);
      }
      x = x3; y = y3;
    } else if (cmd === 'Z' || cmd === 'z') {
      cmd = '';
    } else {
      throw new Error(`Nicht unterstützter Pfadbefehl ${cmd}`);
    }
  }
  return polys;
}

/** Abdeckungsmaske in Sample-Auflösung, Füllregel nonzero. */
function rasterizePath(d, dx) {
  const N = SIZE * SS;
  const mask = new Uint8Array(N * N);
  const edges = [];
  for (const poly of pathToPolygons(d, dx)) {
    for (let k = 0; k < poly.length; k++) {
      const [ux0, uy0] = poly[k];
      const [ux1, uy1] = poly[(k + 1) % poly.length];
      const toS = (u) => (OFFSET + u * SCALE) * SS;
      edges.push([toS(ux0), toS(uy0), toS(ux1), toS(uy1)]);
    }
  }
  for (let row = 0; row < N; row++) {
    const sy = row + 0.5;
    const hits = [];
    for (const [x0, y0, x1, y1] of edges) {
      if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) {
        hits.push([x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0), y1 > y0 ? 1 : -1]);
      }
    }
    if (hits.length === 0) continue;
    hits.sort((a, b) => a[0] - b[0]);
    let winding = 0;
    for (let h = 0; h < hits.length - 1; h++) {
      winding += hits[h][1];
      if (winding === 0) continue;
      const from = Math.max(0, Math.ceil(hits[h][0] - 0.5));
      const to = Math.min(N - 1, Math.floor(hits[h + 1][0] - 0.5));
      mask.fill(1, row * N + from, row * N + to + 1);
    }
  }
  return mask;
}

function renderPng() {
  const N = SIZE * SS;
  const word = rasterizePath(WORDMARK, WORD_DX);
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  const halfLine = LINE_WIDTH / 2;

  for (let py = 0; py < SIZE; py++) {
    const rowStart = py * (SIZE * 4 + 1);
    for (let px = 0; px < SIZE; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS - OFFSET) / SCALE;
          const v = (py + (sy + 0.5) / SS - OFFSET) / SCALE;
          const dTile = tileSdf(u, v);
          if (dTile > 0) continue;
          let c = mix(C.paperTop, C.paperBottom, clamp01(v / 128));
          for (const ly of LINES) {
            const cx = Math.max(LINE_X0, Math.min(LINE_X1, u));
            if (Math.hypot(u - cx, v - ly) <= halfLine) c = C.line;
          }
          if (word[(py * SS + sy) * N + px * SS + sx]) c = C.word;
          const dFold = foldSdf(u, v);
          if (dFold > FOLD.stroke / 2) {
            const dShadow = foldSdf(u - FOLD.shadowDx, v - FOLD.shadowDy);
            const shade = 0.12 * Math.exp(-((Math.max(dShadow, 0) / 2.2) ** 2));
            c = mix(c, [0, 0, 0], shade);
          } else if (dFold < -FOLD.stroke / 2) {
            c = mix(C.foldLight, C.foldDark, clamp01((128 - u + v) / 76));
          } else {
            c = C.foldStroke;
          }
          if (dTile > -0.8) c = mix(c, [0, 0, 0], 0.07);
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const cover = a / (SS * SS);
      // Schlagschatten nach Apples Icon-Vorlage (10 px Versatz, 10 px Weichzeichnung) unter dem freien Anteil
      const du = (px + 0.5 - OFFSET) / SCALE;
      const dv = (py + 0.5 - OFFSET) / SCALE - 1.55;
      const shadow = 0.3 * Math.exp(-((Math.max(tileSdf(du, dv), 0) / 1.15) ** 2));
      const shadowAlpha = shadow * (1 - cover);
      const alpha = cover + shadowAlpha;
      const o = rowStart + 1 + px * 4;
      if (alpha > 0) {
        // Schattenfarbe ist Schwarz: trägt nur Deckkraft bei
        raw[o] = Math.round(a ? (r / a) * (cover / alpha) : 0);
        raw[o + 1] = Math.round(a ? (g / a) * (cover / alpha) : 0);
        raw[o + 2] = Math.round(a ? (b / a) * (cover / alpha) : 0);
      }
      raw[o + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(raw);
}

// ---------- PNG-Kodierung ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('brand', { recursive: true });
mkdirSync('src/assets', { recursive: true });
mkdirSync('src-tauri/icons', { recursive: true });
writeFileSync('brand/flou-icon.svg', iconSvg);
writeFileSync('src/assets/logo.svg', logoSvg);
writeFileSync('src-tauri/icons/source.png', renderPng());
console.log('brand/flou-icon.svg, src/assets/logo.svg, src-tauri/icons/source.png geschrieben');
