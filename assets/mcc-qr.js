/* ============================================================================
   mcc-qr.js — self-contained QR code button for every page
   ----------------------------------------------------------------------------
   Ted Gonzalez, JD/MBA · MCC AI Professional Development
   © 2026. All rights reserved.

   Drop this on any page:
       <script src="/mcc-professional-development/assets/mcc-qr.js" defer></script>

   It adds a small QR button. Clicking it shows a scannable code for whatever
   URL is currently in the address bar — including the #hash — so you can push
   the exact page, deck or mission you are on to every phone in the room.

   No CDN, no network, no dependencies. The encoder is implemented here in full
   so the button still works when campus wifi does not.

   API:
       MCCQR.open()    open the panel
       MCCQR.close()   close it
       MCCQR.hide()    hide the button (e.g. during an intro animation)
       MCCQR.show()    show it again
       MCCQR.svg(text, [ecLevel]) -> SVG string, if you want your own QR
   ========================================================================== */
(function () {
  'use strict';

  /* ========================================================================
     PART 1 — QR ENCODER
     Model 2 symbols, byte mode, versions 1–10, error correction level M
     (recovers ~15% damage). That covers 216 bytes, which is far longer than
     any URL this site will ever produce.
     ====================================================================== */

  /* ---- Galois field GF(256), primitive polynomial 0x11D ---- */
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gmul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* Generator polynomial for `deg` error-correction codewords:
     g(x) = product of (x - a^i) for i = 0..deg-1   */
  function rsPoly(deg) {
    var poly = [1];
    for (var i = 0; i < deg; i++) {
      var next = new Array(poly.length + 1);
      for (var z = 0; z < next.length; z++) next[z] = 0;
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    var gen = rsPoly(ecLen);
    var buf = new Uint8Array(data.length + ecLen);
    buf.set(data, 0);
    for (var i = 0; i < data.length; i++) {
      var factor = buf[i];
      if (factor === 0) continue;
      for (var j = 0; j < gen.length; j++) buf[i + j] ^= gmul(gen[j], factor);
    }
    return buf.subarray(data.length);
  }

  /* ---- Version tables ----
     Each entry: ec = EC codewords per block,
                 g  = [[blockCount, dataCodewordsPerBlock], ...]          */
  var SPEC = {
    /* level L — more data, less damage tolerance */
    L: [
      null,
      { ec: 7, g: [[1, 19]] },
      { ec: 10, g: [[1, 34]] },
      { ec: 15, g: [[1, 55]] },
      { ec: 20, g: [[1, 80]] },
      { ec: 26, g: [[1, 108]] },
      { ec: 18, g: [[2, 68]] },
      { ec: 20, g: [[2, 78]] },
      { ec: 24, g: [[2, 97]] },
      { ec: 30, g: [[2, 116]] },
      { ec: 18, g: [[2, 68], [2, 69]] }
    ],
    /* level M — the default. ~15% recovery, still compact. */
    M: [
      null,
      { ec: 10, g: [[1, 16]] },
      { ec: 16, g: [[1, 28]] },
      { ec: 26, g: [[1, 44]] },
      { ec: 18, g: [[2, 32]] },
      { ec: 24, g: [[2, 43]] },
      { ec: 16, g: [[4, 27]] },
      { ec: 18, g: [[4, 31]] },
      { ec: 22, g: [[2, 38], [2, 39]] },
      { ec: 22, g: [[3, 36], [2, 37]] },
      { ec: 26, g: [[4, 43], [1, 44]] }
    ],
    /* level Q — survives a hand partly covering the code on a projector */
    Q: [
      null,
      { ec: 13, g: [[1, 13]] },
      { ec: 22, g: [[1, 22]] },
      { ec: 18, g: [[2, 17]] },
      { ec: 26, g: [[2, 24]] },
      { ec: 18, g: [[2, 15], [2, 16]] },
      { ec: 24, g: [[4, 19]] },
      { ec: 18, g: [[2, 14], [4, 15]] },
      { ec: 22, g: [[4, 18], [2, 19]] },
      { ec: 20, g: [[4, 16], [4, 17]] },
      { ec: 24, g: [[6, 19], [2, 20]] }
    ]
  };

  /* Error-correction level indicator bits used in the format information */
  var EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /* Alignment pattern centre coordinates per version */
  var ALIGN = [
    null, [], [6, 18], [6, 22], [6, 26], [6, 30],
    [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  /* Remainder bits appended after the final codeword, per version */
  var REMAINDER = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0];

  function totalDataCodewords(spec) {
    var n = 0;
    for (var i = 0; i < spec.g.length; i++) n += spec.g[i][0] * spec.g[i][1];
    return n;
  }

  /* UTF-8 encode, so accented names and non-Latin text survive */
  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  function encode(text, level) {
    level = level || 'M';
    var table = SPEC[level];
    if (!table) throw new Error('mcc-qr: unknown EC level ' + level);

    var bytes = utf8Bytes(text);

    /* Choose the smallest version that fits */
    var version = 0, spec = null, dataCw = 0, countBits = 8;
    for (var v = 1; v <= 10; v++) {
      var s = table[v];
      if (!s) continue;
      var cw = totalDataCodewords(s);
      var cb = v <= 9 ? 8 : 16;
      var needed = 4 + cb + bytes.length * 8;
      if (needed <= cw * 8) {
        version = v; spec = s; dataCw = cw; countBits = cb;
        break;
      }
    }
    if (!version) {
      throw new Error('mcc-qr: content too long (' + bytes.length + ' bytes) for level ' + level);
    }

    /* ---- Build the bit stream ---- */
    var bits = [];
    function push(value, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }
    push(4, 4);                    // byte mode indicator
    push(bytes.length, countBits); // character count
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    var capacity = dataCw * 8;
    var term = Math.min(4, capacity - bits.length);
    push(0, term);                              // terminator
    while (bits.length % 8 !== 0) bits.push(0); // pad to a byte boundary

    var padBytes = [0xec, 0x11], p = 0;
    while (bits.length < capacity) { push(padBytes[p % 2], 8); p++; }

    /* ---- Bits to codewords ---- */
    var all = new Uint8Array(dataCw);
    for (var b = 0; b < dataCw; b++) {
      var byteVal = 0;
      for (var k = 0; k < 8; k++) byteVal = (byteVal << 1) | bits[b * 8 + k];
      all[b] = byteVal;
    }

    /* ---- Split into blocks, compute EC, interleave ---- */
    var blocks = [], ecBlocks = [], offset = 0;
    for (var gi = 0; gi < spec.g.length; gi++) {
      var count = spec.g[gi][0], size = spec.g[gi][1];
      for (var n = 0; n < count; n++) {
        var chunk = all.subarray(offset, offset + size);
        offset += size;
        blocks.push(chunk);
        ecBlocks.push(rsEncode(chunk, spec.ec));
      }
    }

    var maxData = 0;
    for (var bi = 0; bi < blocks.length; bi++) maxData = Math.max(maxData, blocks[bi].length);

    var finalBits = [];
    function pushByte(val) { for (var i = 7; i >= 0; i--) finalBits.push((val >>> i) & 1); }

    for (var col = 0; col < maxData; col++) {
      for (var bj = 0; bj < blocks.length; bj++) {
        if (col < blocks[bj].length) pushByte(blocks[bj][col]);
      }
    }
    for (var ec = 0; ec < spec.ec; ec++) {
      for (var bk = 0; bk < ecBlocks.length; bk++) pushByte(ecBlocks[bk][ec]);
    }
    for (var r = 0; r < REMAINDER[version]; r++) finalBits.push(0);

    return buildMatrix(version, level, finalBits);
  }

  /* ---- Matrix construction ---- */
  function buildMatrix(version, level, dataBits) {
    var size = version * 4 + 17;
    var m = [], reserved = [], i, j;
    for (i = 0; i < size; i++) {
      m.push(new Uint8Array(size));
      var row = new Array(size);
      for (j = 0; j < size; j++) row[j] = false;
      reserved.push(row);
    }

    function finder(r, c) {
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          var on =
            (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
            (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) ||
            (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
          m[rr][cc] = on ? 1 : 0;
          reserved[rr][cc] = true;
        }
      }
    }
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    /* timing patterns */
    for (i = 8; i < size - 8; i++) {
      var t = i % 2 === 0 ? 1 : 0;
      m[6][i] = t; reserved[6][i] = true;
      m[i][6] = t; reserved[i][6] = true;
    }

    /* alignment patterns */
    var ap = ALIGN[version];
    for (var a = 0; a < ap.length; a++) {
      for (var b = 0; b < ap.length; b++) {
        var r = ap[a], c = ap[b];
        if ((r <= 8 && c <= 8) ||
            (r <= 8 && c >= size - 9) ||
            (r >= size - 9 && c <= 8)) continue;
        for (var dr2 = -2; dr2 <= 2; dr2++) {
          for (var dc2 = -2; dc2 <= 2; dc2++) {
            var on2 = Math.max(Math.abs(dr2), Math.abs(dc2)) !== 1;
            m[r + dr2][c + dc2] = on2 ? 1 : 0;
            reserved[r + dr2][c + dc2] = true;
          }
        }
      }
    }

    /* dark module — always set, never data */
    m[size - 8][8] = 1;
    reserved[size - 8][8] = true;

    /* reserve the format information areas */
    for (i = 0; i <= 8; i++) { reserved[8][i] = true; reserved[i][8] = true; }
    for (i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }

    /* reserve version information areas (version 7 and up) */
    if (version >= 7) {
      for (i = 0; i < 6; i++) {
        for (j = 0; j < 3; j++) {
          reserved[size - 11 + j][i] = true;
          reserved[i][size - 11 + j] = true;
        }
      }
    }

    /* ---- Place the data in the zigzag order ---- */
    var idx = 0, upward = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--; /* skip the vertical timing column */
      for (var k = 0; k < size; k++) {
        var rowIdx = upward ? size - 1 - k : k;
        for (var d = 0; d < 2; d++) {
          var colIdx = col - d;
          if (reserved[rowIdx][colIdx]) continue;
          m[rowIdx][colIdx] = idx < dataBits.length ? dataBits[idx] : 0;
          idx++;
        }
      }
      upward = !upward;
    }

    /* ---- Try all eight masks, keep the lowest penalty ---- */
    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mask = 0; mask < 8; mask++) {
      var cand = applyMask(m, reserved, size, mask);
      placeFormat(cand, size, level, mask);
      if (version >= 7) placeVersion(cand, size, version);
      var score = penalty(cand, size);
      if (score < bestScore) { bestScore = score; best = cand; bestMask = mask; }
    }
    return { size: size, modules: best, version: version, mask: bestMask, level: level };
  }

  function maskFn(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function applyMask(m, reserved, size, mask) {
    var out = [];
    for (var r = 0; r < size; r++) {
      out.push(new Uint8Array(size));
      for (var c = 0; c < size; c++) {
        var v = m[r][c];
        if (!reserved[r][c] && maskFn(mask, r, c)) v ^= 1;
        out[r][c] = v;
      }
    }
    return out;
  }

  function placeFormat(m, size, level, mask) {
    var data = (EC_BITS[level] << 3) | mask;
    var rem = data << 10;
    for (var i = 14; i >= 10; i--) {
      if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
    }
    var fmt = ((data << 10) | rem) ^ 0x5412;
    function bit(n) { return (fmt >>> n) & 1; }

    /* Bit 14 is the most significant and is placed first. Getting this
       backwards produces a symbol that looks perfect and scans as nothing. */
    var i2;

    /* Copy 1 — wrapped around the top-left finder */
    for (i2 = 0; i2 <= 5; i2++) m[8][i2] = bit(14 - i2);
    m[8][7] = bit(8);
    m[8][8] = bit(7);
    m[7][8] = bit(6);
    for (i2 = 0; i2 <= 5; i2++) m[i2][8] = bit(i2);

    /* Copy 2 — split between the bottom-left and top-right finders */
    for (i2 = 0; i2 <= 6; i2++) m[size - 1 - i2][8] = bit(14 - i2);
    for (i2 = 0; i2 <= 7; i2++) m[8][size - 8 + i2] = bit(7 - i2);

    m[size - 8][8] = 1; /* dark module stays set */
  }

  function placeVersion(m, size, version) {
    var rem = version << 12;
    for (var i = 17; i >= 12; i--) {
      if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
    }
    var vinfo = (version << 12) | rem;
    for (var k = 0; k < 18; k++) {
      var bit = (vinfo >>> k) & 1;
      var a = Math.floor(k / 3), b = k % 3;
      m[a][size - 11 + b] = bit;
      m[size - 11 + b][a] = bit;
    }
  }

  function penalty(m, size) {
    var score = 0, r, c, run, i;

    /* Rule 1 — runs of five or more identical modules */
    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) { run++; }
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) { run++; }
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }

    /* Rule 2 — 2x2 blocks of one colour */
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }

    /* Rule 3 — finder-like patterns */
    var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function matches(get, start, pat) {
      for (var q = 0; q < 11; q++) if (get(start + q) !== pat[q]) return false;
      return true;
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c <= size - 11; c++) {
        /* eslint-disable no-loop-func */
        var getRow = (function (rr) { return function (x) { return m[rr][x]; }; })(r);
        if (matches(getRow, c, pat1) || matches(getRow, c, pat2)) score += 40;
      }
    }
    for (c = 0; c < size; c++) {
      for (r = 0; r <= size - 11; r++) {
        var getCol = (function (cc) { return function (x) { return m[x][cc]; }; })(c);
        if (matches(getCol, r, pat1) || matches(getCol, r, pat2)) score += 40;
      }
    }

    /* Rule 4 — overall balance of dark and light */
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += m[r][c];
    var pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;

    return score;
  }

  /* ---- Renderers ---- */
  function toSvg(text, level, opts) {
    opts = opts || {};
    var qr = encode(text, level || 'M');
    var quiet = opts.quiet == null ? 4 : opts.quiet;
    var dim = qr.size + quiet * 2;
    var dark = opts.dark || '#0A1A2E';
    var light = opts.light || '#ffffff';

    var path = '';
    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (qr.modules[r][c]) {
          path += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code linking to ' +
      escapeAttr(text) + '">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>' +
      '<path d="' + path + '" fill="' + dark + '"/></svg>';
  }

  function escapeAttr(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* ========================================================================
     PART 2 — THE BUTTON AND PANEL
     ====================================================================== */

  if (typeof document === 'undefined') {
    /* Running under Node for tests — export and stop here. */
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = { encode: encode, toSvg: toSvg };
    }
    return;
  }

  var CSS =
  '.mccqr-btn{position:fixed;left:20px;bottom:20px;z-index:9998;width:46px;height:46px;' +
    'border-radius:14px;border:1px solid rgba(255,255,255,.22);background:#0A1A2E;color:#fff;' +
    'display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;' +
    'box-shadow:0 6px 22px rgba(0,0,0,.34);transition:transform .2s ease,background .2s ease}' +
  '.mccqr-btn:hover{background:#123054;transform:translateY(-2px)}' +
  '.mccqr-btn:focus-visible{outline:3px solid #FF6600;outline-offset:3px}' +
  '.mccqr-btn svg{width:24px;height:24px;display:block}' +
  '.mccqr-btn[hidden]{display:none}' +
  '.mccqr-ov{position:fixed;inset:0;z-index:9999;background:rgba(4,10,20,.82);' +
    'display:flex;align-items:center;justify-content:center;padding:24px;' +
    '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
  '.mccqr-ov[hidden]{display:none}' +
  '.mccqr-card{background:#fff;color:#0A1A2E;border-radius:20px;padding:26px;max-width:min(94vw,460px);' +
    'width:100%;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.5);position:relative;' +
    'font-family:Poppins,"Century Gothic",system-ui,-apple-system,"Segoe UI",sans-serif}' +
  '.mccqr-card h2{font-size:17px;font-weight:700;margin:0 0 4px}' +
  '.mccqr-card .mccqr-sub{font-size:12.5px;color:#5C6E82;margin:0 0 18px}' +
  '.mccqr-code{background:#fff;border:1px solid #e3e8ee;border-radius:14px;padding:12px;' +
    'display:block;margin:0 auto;width:100%;max-width:290px}' +
  '.mccqr-code svg{width:100%;height:auto;display:block}' +
  '.mccqr-url{margin:16px 0 0;font-size:11.5px;line-height:1.5;color:#41556b;word-break:break-all;' +
    'background:#f4f7fa;border-radius:9px;padding:10px 12px;font-family:ui-monospace,Menlo,Consolas,monospace}' +
  '.mccqr-row{display:flex;gap:9px;margin-top:16px;flex-wrap:wrap;justify-content:center}' +
  '.mccqr-act{border:1px solid #cfd8e3;background:#fff;color:#0A1A2E;border-radius:10px;' +
    'padding:10px 15px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;' +
    'transition:background .18s,border-color .18s}' +
  '.mccqr-act:hover{background:#eef3f8;border-color:#9fb2c6}' +
  '.mccqr-act:focus-visible{outline:3px solid #FF6600;outline-offset:2px}' +
  '.mccqr-act.p{background:#FF6600;border-color:#FF6600;color:#fff}' +
  '.mccqr-act.p:hover{background:#e25c00}' +
  '.mccqr-x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:9px;' +
    'border:none;background:transparent;color:#5C6E82;font-size:21px;line-height:1;cursor:pointer;' +
    'font-family:inherit}' +
  '.mccqr-x:hover{background:#eef3f8;color:#0A1A2E}' +
  '.mccqr-x:focus-visible{outline:3px solid #FF6600;outline-offset:2px}' +
  '.mccqr-note{margin-top:14px;font-size:11px;color:#7c8da0}' +
  /* Projector mode — fills the screen so the back row can scan it */
  '.mccqr-ov.big{background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}' +
  '.mccqr-ov.big .mccqr-card{max-width:none;width:auto;box-shadow:none;padding:10px}' +
  '.mccqr-ov.big .mccqr-code{max-width:min(78vh,78vw);border:none;padding:0}' +
  '.mccqr-ov.big h2,.mccqr-ov.big .mccqr-sub,.mccqr-ov.big .mccqr-note{display:none}' +
  '.mccqr-ov.big .mccqr-url{font-size:15px;background:none;color:#0A1A2E;font-weight:600}' +
  '@media print{.mccqr-btn,.mccqr-ov{display:none!important}}' +
  '@media (max-width:560px){.mccqr-btn{left:14px;bottom:14px;width:42px;height:42px}}' +
  '@media (prefers-reduced-motion:reduce){.mccqr-btn{transition:none}}';

  var ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="7" height="7" rx="1.4"/>' +
    '<rect x="14" y="3" width="7" height="7" rx="1.4"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1.4"/>' +
    '<path d="M14 14h3v3h-3zM19.5 14v.01M14 19.5v.01M19.5 19.5v.01"/></svg>';

  var btn, overlay, card, codeBox, urlBox, lastFocus, bigMode = false;

  function currentUrl() { return window.location.href; }

  function render() {
    var url = currentUrl();
    /* Level Q if it comfortably fits — a little extra damage tolerance helps
       when someone's head is partly in front of the projector screen. */
    var svg;
    try {
      svg = toSvg(url, 'Q');
    } catch (e) {
      try { svg = toSvg(url, 'M'); }
      catch (e2) { svg = toSvg(url, 'L'); }
    }
    codeBox.innerHTML = svg;
    urlBox.textContent = url.replace(/^https?:\/\//, '');
  }

  function open() {
    lastFocus = document.activeElement;
    render();
    overlay.hidden = false;
    document.addEventListener('keydown', onKey, true);
    var first = card.querySelector('.mccqr-act');
    if (first) first.focus();
  }

  function close() {
    overlay.hidden = true;
    bigMode = false;
    overlay.classList.remove('big');
    document.removeEventListener('keydown', onKey, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = card.querySelectorAll('button');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function install() {
    if (document.querySelector('.mccqr-btn')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    btn = document.createElement('button');
    btn.className = 'mccqr-btn';
    btn.type = 'button';
    btn.innerHTML = ICON;
    btn.setAttribute('aria-label', 'Show a QR code for this page');
    btn.title = 'QR code for this page  (Shift + Q)';
    /* Put data-qr-start-hidden on <html> to keep the button out of an intro
       animation, then call MCCQR.show() when the page is ready for it. */
    if (document.documentElement.hasAttribute('data-qr-start-hidden')) btn.hidden = true;
    btn.addEventListener('click', open);
    document.body.appendChild(btn);

    /* The button floats over the bottom-left corner. Give any page footer
       enough clearance that it never sits on top of the byline. */
    var foot = document.querySelector('footer');
    if (foot) {
      var pad = parseFloat(getComputedStyle(foot).paddingBottom) || 0;
      if (pad < 74) foot.style.paddingBottom = '74px';
    }

    overlay = document.createElement('div');
    overlay.className = 'mccqr-ov';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="mccqr-card" role="dialog" aria-modal="true" aria-label="QR code for this page">' +
        '<button class="mccqr-x" type="button" aria-label="Close">&times;</button>' +
        '<h2>Scan to open this page</h2>' +
        '<p class="mccqr-sub">Points at exactly what is on screen right now</p>' +
        '<div class="mccqr-code"></div>' +
        '<p class="mccqr-url"></p>' +
        '<div class="mccqr-row">' +
          '<button class="mccqr-act p" type="button" data-a="big">Project it</button>' +
          '<button class="mccqr-act" type="button" data-a="copy">Copy link</button>' +
          '<button class="mccqr-act" type="button" data-a="print">Print</button>' +
        '</div>' +
        '<p class="mccqr-note">Generated on this device. Nothing is sent anywhere.</p>' +
      '</div>';
    document.body.appendChild(overlay);

    card = overlay.querySelector('.mccqr-card');
    codeBox = overlay.querySelector('.mccqr-code');
    urlBox = overlay.querySelector('.mccqr-url');

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.mccqr-x').addEventListener('click', close);

    card.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-a]') : null;
      if (!b) return;
      var act = b.getAttribute('data-a');

      if (act === 'big') {
        bigMode = !bigMode;
        overlay.classList.toggle('big', bigMode);
        b.textContent = bigMode ? 'Exit projector view' : 'Project it';
      } else if (act === 'copy') {
        var url = currentUrl();
        var done = function () {
          var old = b.textContent;
          b.textContent = 'Copied';
          setTimeout(function () { b.textContent = old; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url, done); });
        } else {
          fallbackCopy(url, done);
        }
      } else if (act === 'print') {
        window.print();
      }
    });

    /* Keep the code in step with hash navigation */
    window.addEventListener('hashchange', function () { if (!overlay.hidden) render(); });

    /* Shift + Q from anywhere, as long as you are not typing */
    document.addEventListener('keydown', function (e) {
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (String(e.key).toLowerCase() !== 'q') return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      e.preventDefault();
      if (overlay.hidden) open(); else close();
    });
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* nothing to do */ }
    document.body.removeChild(ta);
  }

  function installProtectedShell() {
    var match = location.pathname.match(/\/(sandbox|inbox|workshop)\/(?:index\.html)?$/);
    if (!match) return;
    var settings = {
      sandbox: { id: 'sandbox', mode: 'nav-only' },
      inbox: { id: 'inbox', mode: 'full', target: '#list' },
      workshop: { id: 'workshop', mode: 'nav-only' }
    }[match[1]];
    document.body.dataset.mccActivity = settings.id;
    document.body.dataset.activityShellMode = settings.mode;
    if (settings.target) document.body.dataset.activityTarget = settings.target;
    if (settings.mode === 'full' && !document.querySelector('[data-activity-shell-mount]')) {
      var main = document.querySelector('main');
      if (main) { var mount = document.createElement('div'); mount.setAttribute('data-activity-shell-mount', ''); main.insertBefore(mount, main.firstChild); }
    }
    var legacy = document.querySelector('body > .bar');
    if (legacy) legacy.setAttribute('data-mcc-legacy-nav', '');
    var own = Array.prototype.slice.call(document.scripts).find(function (s) { return /mcc-qr\.js(?:\?|$)/.test(s.src); });
    if (!own) return;
    var root = new URL('../', own.src);
    if (!document.querySelector('link[href*="mcc-activity-shell.css"]')) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('assets/mcc-activity-shell.css', root).href; document.head.appendChild(css);
    }
    function loadShell() {
      if (document.querySelector('script[src*="mcc-activity-shell.js"]')) return;
      var shell = document.createElement('script'); shell.src = new URL('assets/mcc-activity-shell.js', root).href; document.body.appendChild(shell);
    }
    if (window.MCC_CONTENT) loadShell();
    else {
      var content = document.createElement('script'); content.src = new URL('assets/mcc-content.js', root).href; content.onload = loadShell; document.body.appendChild(content);
    }
  }

  function installMacGuide() {
    var own = Array.prototype.slice.call(document.scripts).find(function (s) { return /mcc-qr\.js(?:\?|$)/.test(s.src); });
    if (!own || document.querySelector('script[src*="mac-guide.js"]')) return;
    var root = new URL('../', own.src);
    if (!document.querySelector('link[href*="mac-guide.css"]')) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('assets/mac-guide.css', root).href; document.head.appendChild(css);
    }
    var guide = document.createElement('script'); guide.src = new URL('assets/mac-guide.js', root).href; guide.defer = true; document.body.appendChild(guide);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { install(); installProtectedShell(); installMacGuide(); });
  } else {
    install(); installProtectedShell(); installMacGuide();
  }

  window.MCCQR = {
    open: open,
    close: close,
    hide: function () { if (btn) btn.hidden = true; },
    show: function () { if (btn) btn.hidden = false; },
    svg: toSvg,
    encode: encode
  };
})();
