/* ==========================================================================
 * qr-engine.js — Generador de códigos QR en JavaScript puro (sin CDN, offline).
 *
 * Soporta modo byte (UTF-8), nivel de corrección L, versiones 1..5 (bloque
 * único, hasta 108 bytes → de sobra para una URL de carta). Implementa GF(256)
 * + Reed-Solomon, patrones de posición/alineación/temporización, las 8 máscaras
 * con selección por penalización y la información de formato (BCH).
 *
 * API:  qrMatrix(text) → { size, modules:boolean[][] }
 *       renderQrInto(element, text) → pinta el QR en un canvas dentro de element
 * ========================================================================== */

(function (global) {
  // Codewords de datos por versión (nivel L, bloque único) y EC codewords.
  const DATA_CODEWORDS = { 1: 19, 2: 34, 3: 55, 4: 80, 5: 108 };
  const EC_CODEWORDS = { 1: 7, 2: 10, 3: 15, 4: 20, 5: 26 };
  const ALIGN_CENTER = { 1: null, 2: 18, 3: 22, 4: 26, 5: 30 };

  // ── Campo de Galois GF(256), primitivo 0x11d ───────────────────────
  const EXP = new Array(512);
  const LOG = new Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  function rsGenerator(nsym) {
    // Producto de (x - α^i) para i en [0, nsym) sobre GF(256).
    let poly = [1];
    for (let i = 0; i < nsym; i++) {
      const p = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        p[j] ^= gfMul(poly[j], EXP[i]);
        p[j + 1] ^= poly[j];
      }
      poly = p;
    }
    // poly queda en orden ascendente (constante primero); rsEncode espera el
    // coeficiente líder primero.
    return poly.reverse();
  }

  function rsEncode(data, nsym) {
    const gen = rsGenerator(nsym);
    const res = data.concat(new Array(nsym).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef);
      }
    }
    return res.slice(data.length);
  }

  // ── Bytes de datos (modo byte + longitud + relleno) ────────────────
  function utf8Bytes(str) {
    return Array.from(new TextEncoder().encode(str));
  }

  function chooseVersion(byteLen) {
    for (let v = 1; v <= 5; v++) if (byteLen + 2 <= DATA_CODEWORDS[v]) return v;
    return null; // demasiado largo
  }

  function buildDataCodewords(bytes, version) {
    const bits = [];
    const push = (value, len) => { for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1); };
    push(0b0100, 4);            // modo byte
    push(bytes.length, 8);      // longitud (versiones 1..9 → 8 bits)
    bytes.forEach((b) => push(b, 8));
    const capacityBits = DATA_CODEWORDS[version] * 8;
    // terminador
    for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      codewords.push(byte);
    }
    const pad = [0xec, 0x11];
    let k = 0;
    while (codewords.length < DATA_CODEWORDS[version]) codewords.push(pad[k++ % 2]);
    return codewords;
  }

  // ── Construcción de la matriz ──────────────────────────────────────
  function makeMatrix(version) {
    const size = 17 + version * 4;
    const modules = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    const setFn = (r, c, v) => { modules[r][c] = v ? 1 : 0; reserved[r][c] = true; };

    // Patrones de posición (finder) + separadores
    const placeFinder = (r, c) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const rr = r + dr; const cc = c + dc;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
            (dr === 0 || dr === 6 || dc === 0 || dc === 6);
          const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setFn(rr, cc, inRing || inCore);
        }
      }
    };
    placeFinder(0, 0); placeFinder(0, size - 7); placeFinder(size - 7, 0);

    // Temporización
    for (let i = 8; i < size - 8; i++) {
      setFn(6, i, i % 2 === 0);
      setFn(i, 6, i % 2 === 0);
    }

    // Patrón de alineación
    const center = ALIGN_CENTER[version];
    if (center) {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          setFn(center + dr, center + dc, ring !== 1);
        }
      }
    }

    // Módulo oscuro fijo
    setFn(size - 8, 8, true);

    // Reservar zonas de información de formato (se rellenan al final)
    for (let i = 0; i < 9; i++) {
      if (!reserved[8][i]) reserved[8][i] = true;
      if (!reserved[i][8]) reserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
      if (!reserved[8][size - 1 - i]) reserved[8][size - 1 - i] = true;
      if (!reserved[size - 1 - i][8]) reserved[size - 1 - i][8] = true;
    }

    return { size, modules, reserved };
  }

  function placeData(matrix, allCodewords) {
    const { size, modules, reserved } = matrix;
    const bits = [];
    allCodewords.forEach((cw) => { for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1); });
    let idx = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5; // saltar la columna de temporización (reasigna col)
      for (let i = 0; i < size; i++) {
        const row = upward ? size - 1 - i : i;
        for (let k = 0; k < 2; k++) {
          const cc = col - k;
          if (reserved[row][cc]) continue;
          modules[row][cc] = idx < bits.length ? bits[idx] : 0;
          idx++;
        }
      }
      upward = !upward;
    }
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function applyMask(matrix, maskIndex) {
    const { size, modules, reserved } = matrix;
    const out = modules.map((row) => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (reserved[r][c]) continue;
        if (MASKS[maskIndex](r, c)) out[r][c] = out[r][c] ? 0 : 1;
      }
    }
    return out;
  }

  // Información de formato (nivel L = 01) con BCH y máscara 0x5412
  function formatBits(maskIndex) {
    const data = (0b01 << 3) | maskIndex;
    let bch = data << 10;
    const g = 0b10100110111;
    for (let i = 14; i >= 10; i--) if ((bch >> i) & 1) bch ^= g << (i - 10);
    const format = ((data << 10) | bch) ^ 0b101010000010010;
    const bits = [];
    for (let i = 14; i >= 0; i--) bits.push((format >> i) & 1);
    return bits;
  }

  function placeFormat(size, grid, maskIndex) {
    const bits = formatBits(maskIndex);
    // Alrededor del finder superior-izquierdo
    const coords1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
    coords1.forEach(([r, c], i) => { grid[r][c] = bits[i]; });
    // Copia a lo largo de los otros dos finders
    for (let i = 0; i < 8; i++) grid[size - 1 - i][8] = bits[i];
    for (let i = 0; i < 7; i++) grid[8][size - 7 + i] = bits[8 + i];
  }

  function penalty(size, grid) {
    let score = 0;
    // Regla 1: cinco o más módulos iguales en fila/columna
    for (let r = 0; r < size; r++) {
      for (let dir = 0; dir < 2; dir++) {
        let run = 1;
        for (let c = 1; c < size; c++) {
          const a = dir === 0 ? grid[r][c] : grid[c][r];
          const b = dir === 0 ? grid[r][c - 1] : grid[c - 1][r];
          if (a === b) { run++; if (run === 5) score += 3; else if (run > 5) score += 1; }
          else run = 1;
        }
      }
    }
    // Regla 3: patrón 1011101 con zona clara → penalización 40
    const patt = [1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 6; c++) {
        if (patt.every((p, i) => grid[r][c + i] === p)) score += 40;
        if (patt.every((p, i) => grid[c + i][r] === p)) score += 40;
      }
    }
    return score;
  }

  function qrMatrix(text, forceMask) {
    const bytes = utf8Bytes(String(text || ''));
    const version = chooseVersion(bytes.length);
    if (!version) throw new Error('Texto demasiado largo para el QR (máx ~106 bytes).');
    const dataCw = buildDataCodewords(bytes, version);
    const ecCw = rsEncode(dataCw, EC_CODEWORDS[version]);
    const all = dataCw.concat(ecCw);
    const matrix = makeMatrix(version);
    placeData(matrix, all);

    let best = null;
    for (let m = 0; m < 8; m++) {
      if (forceMask != null && m !== forceMask) continue;
      const grid = applyMask(matrix, m);
      placeFormat(matrix.size, grid, m);
      const p = penalty(matrix.size, grid);
      if (!best || p < best.p) best = { p, grid, m };
    }
    return { size: matrix.size, modules: best.grid.map((row) => row.map((v) => v === 1)), mask: best.m };
  }

  function renderQrInto(element, text) {
    if (!element) return;
    try {
      const { size, modules } = qrMatrix(text);
      const quiet = 4;
      const total = size + quiet * 2;
      const scale = 6;
      const canvas = document.createElement('canvas');
      canvas.width = total * scale;
      canvas.height = total * scale;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.imageRendering = 'pixelated';
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a1a1a';
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (modules[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
      element.innerHTML = '';
      element.appendChild(canvas);
    } catch (error) {
      element.textContent = 'QR';
    }
  }

  global.qrMatrix = qrMatrix;
  global.renderQrInto = renderQrInto;
  if (typeof module !== 'undefined' && module.exports) module.exports = { qrMatrix, renderQrInto };
})(typeof window !== 'undefined' ? window : globalThis);
