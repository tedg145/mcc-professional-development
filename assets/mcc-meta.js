/* ============================================================================
   mcc-meta.js — client-side file metadata reader
   ----------------------------------------------------------------------------
   Ted Gonzalez, JD/MBA · MCC AI Professional Development
   © 2026. All rights reserved.

   Reads metadata out of JPEG, PNG, HEIC-ish, PDF and Office files entirely in
   the browser. Nothing is uploaded. No dependencies.

   Office support uses the browser's built-in DecompressionStream, so ZIP
   contents are read without a third-party inflate library.

   Entry point:
       MCCMeta.read(file) -> Promise<Report>

   Report = {
     file:    { name, size, type, lastModified },
     groups:  [ { name, icon, rows:[{k, v, note}] } ],
     gps:     { lat, lon, label } | null,
     flags:   [ { level:'high'|'note', text } ],
     kind:    'jpeg' | 'png' | 'pdf' | 'office' | 'unknown',
     error:   string | null
   }
   ========================================================================== */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- utils */

  function fmtBytes(n) {
    if (n < 1024) return n + ' bytes';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function readSlice(file, start, end) {
    return file.slice(start, end).arrayBuffer();
  }

  function ascii(view, offset, length) {
    var s = '';
    for (var i = 0; i < length; i++) {
      var c = view.getUint8(offset + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  function utf8(buf) {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  }

  function latin(buf) {
    var out = '', a = new Uint8Array(buf);
    for (var i = 0; i < a.length; i++) out += String.fromCharCode(a[i]);
    return out;
  }

  /* Turn "2024:05:14 10:32:07" into something a person can read */
  function prettyExifDate(s) {
    var m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s || '');
    if (!m) return s;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (isNaN(d)) return s;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit'
    });
  }

  function prettyIso(s) {
    var d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  /* PDF dates look like  D:20240514103207-05'00'  */
  function prettyPdfDate(s) {
    var m = /D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/.exec(s || '');
    if (!m) return s;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    if (isNaN(d)) return s;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit'
    });
  }

  /* ------------------------------------------------------------ EXIF/TIFF */

  var IFD0_TAGS = {
    0x010e: 'Description',
    0x010f: 'Camera make',
    0x0110: 'Camera model',
    0x0112: 'Orientation',
    0x011a: 'X resolution',
    0x011b: 'Y resolution',
    0x0131: 'Software',
    0x0132: 'File changed',
    0x013b: 'Artist',
    0x8298: 'Copyright'
  };

  var EXIF_TAGS = {
    0x829a: 'Exposure time',
    0x829d: 'F number',
    0x8827: 'ISO',
    0x9003: 'Date taken',
    0x9004: 'Date digitised',
    0x920a: 'Focal length',
    0xa002: 'Image width',
    0xa003: 'Image height',
    0xa430: 'Camera owner',
    0xa431: 'Body serial number',
    0xa433: 'Lens make',
    0xa434: 'Lens model',
    0xa435: 'Lens serial number',
    0x9286: 'User comment',
    0xa420: 'Image unique ID'
  };

  var GPS_TAGS = {
    0x0000: 'GPS version',
    0x0001: 'Latitude ref',
    0x0002: 'Latitude',
    0x0003: 'Longitude ref',
    0x0004: 'Longitude',
    0x0005: 'Altitude ref',
    0x0006: 'Altitude',
    0x0007: 'GPS time',
    0x0012: 'Map datum',
    0x001d: 'GPS date'
  };

  var ORIENTATION = {
    1: 'Normal', 2: 'Mirrored', 3: 'Rotated 180°', 4: 'Mirrored, rotated 180°',
    5: 'Mirrored, rotated 90° CCW', 6: 'Rotated 90° CW',
    7: 'Mirrored, rotated 90° CW', 8: 'Rotated 90° CCW'
  };

  var TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

  function readIfd(view, tiffStart, ifdOffset, little, tagNames, out, pointers) {
    var count;
    try { count = view.getUint16(tiffStart + ifdOffset, little); }
    catch (e) { return; }
    if (count > 512) return; /* clearly not a real IFD */

    for (var i = 0; i < count; i++) {
      var entry = tiffStart + ifdOffset + 2 + i * 12;
      if (entry + 12 > view.byteLength) return;

      var tag = view.getUint16(entry, little);
      var type = view.getUint16(entry + 2, little);
      var num = view.getUint32(entry + 4, little);
      var size = TYPE_SIZE[type];
      if (!size) continue;

      var total = size * num;
      var valueOffset = total <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, little);
      if (valueOffset < 0 || valueOffset + Math.min(total, 4) > view.byteLength) continue;

      /* Sub-IFD pointers */
      if (pointers && pointers[tag]) {
        pointers[tag].offset = view.getUint32(entry + 8, little);
        continue;
      }

      var name = tagNames[tag];
      if (!name) continue;

      var value = null;
      try {
        if (type === 2) {
          value = ascii(view, valueOffset, Math.min(num, 200)).trim();
        } else if (type === 3) {
          var shorts = [];
          for (var s = 0; s < Math.min(num, 8); s++) shorts.push(view.getUint16(valueOffset + s * 2, little));
          value = shorts;
        } else if (type === 4) {
          var longs = [];
          for (var l = 0; l < Math.min(num, 8); l++) longs.push(view.getUint32(valueOffset + l * 4, little));
          value = longs;
        } else if (type === 5 || type === 10) {
          var rats = [];
          for (var r = 0; r < Math.min(num, 8); r++) {
            var off = valueOffset + r * 8;
            if (off + 8 > view.byteLength) break;
            var numer = type === 5 ? view.getUint32(off, little) : view.getInt32(off, little);
            var denom = type === 5 ? view.getUint32(off + 4, little) : view.getInt32(off + 4, little);
            rats.push(denom === 0 ? 0 : numer / denom);
          }
          value = rats;
        } else if (type === 1 || type === 7) {
          var bytes = [];
          for (var b = 0; b < Math.min(num, 64); b++) bytes.push(view.getUint8(valueOffset + b));
          value = bytes;
        }
      } catch (e) { continue; }

      if (value !== null && value !== '') out[name] = value;
    }
  }

  function parseTiff(view, tiffStart) {
    var result = { ifd0: {}, exif: {}, gps: {} };
    if (tiffStart + 8 > view.byteLength) return result;

    var byteOrder = view.getUint16(tiffStart, false);
    var little = byteOrder === 0x4949;
    if (!little && byteOrder !== 0x4d4d) return result;
    if (view.getUint16(tiffStart + 2, little) !== 0x002a) return result;

    var ifd0Offset = view.getUint32(tiffStart + 4, little);
    var pointers = { 0x8769: { offset: 0 }, 0x8825: { offset: 0 } };

    readIfd(view, tiffStart, ifd0Offset, little, IFD0_TAGS, result.ifd0, pointers);
    if (pointers[0x8769].offset) {
      readIfd(view, tiffStart, pointers[0x8769].offset, little, EXIF_TAGS, result.exif, null);
    }
    if (pointers[0x8825].offset) {
      readIfd(view, tiffStart, pointers[0x8825].offset, little, GPS_TAGS, result.gps, null);
    }
    return result;
  }

  function dmsToDecimal(parts, ref) {
    if (!parts || parts.length < 2) return null;
    var deg = parts[0] || 0, min = parts[1] || 0, sec = parts[2] || 0;
    var dec = deg + min / 60 + sec / 3600;
    if (ref === 'S' || ref === 'W') dec = -dec;
    return dec;
  }

  /* -------------------------------------------------------------- JPEG */

  async function readJpeg(file) {
    var buf = await readSlice(file, 0, Math.min(file.size, 2 * 1024 * 1024));
    var view = new DataView(buf);
    var report = { kind: 'jpeg', groups: [], gps: null, flags: [], raw: {} };

    if (view.getUint16(0, false) !== 0xffd8) {
      report.error = 'That does not look like a JPEG after all.';
      return report;
    }

    var offset = 2, exifData = null, dims = null, comment = null, hasApp13 = false, xmp = null;

    while (offset < view.byteLength - 4) {
      if (view.getUint8(offset) !== 0xff) { offset++; continue; }
      var marker = view.getUint8(offset + 1);
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      if (marker === 0xda) break; /* start of scan — image data from here */

      var len = view.getUint16(offset + 2, false);
      if (len < 2) break;
      var segStart = offset + 4, segLen = len - 2;

      if (marker === 0xe1) {
        var tag = ascii(view, segStart, 6);
        if (tag.indexOf('Exif') === 0) {
          exifData = parseTiff(view, segStart + 6);
        } else if (tag.indexOf('http') === 0 || ascii(view, segStart, 29).indexOf('ns.adobe.com') > -1) {
          xmp = utf8(buf.slice(segStart, segStart + Math.min(segLen, 8000)));
        }
      } else if (marker === 0xed) {
        hasApp13 = true; /* Photoshop IPTC block */
      } else if (marker === 0xfe) {
        comment = utf8(buf.slice(segStart, segStart + segLen)).trim();
      } else if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        dims = { h: view.getUint16(segStart + 1, false), w: view.getUint16(segStart + 3, false) };
      }
      offset += 2 + len;
    }

    /* ---- assemble the report ---- */
    var e = exifData || { ifd0: {}, exif: {}, gps: {} };

    var camera = [];
    if (e.ifd0['Camera make']) camera.push({ k: 'Camera make', v: e.ifd0['Camera make'] });
    if (e.ifd0['Camera model']) camera.push({ k: 'Camera model', v: e.ifd0['Camera model'] });
    if (e.exif['Lens model']) camera.push({ k: 'Lens', v: e.exif['Lens model'] });
    if (e.exif['Body serial number']) {
      camera.push({
        k: 'Body serial number', v: e.exif['Body serial number'],
        note: 'Ties every photo from this camera to the same physical device.'
      });
    }
    if (e.exif['Lens serial number']) camera.push({ k: 'Lens serial number', v: e.exif['Lens serial number'] });
    if (e.exif['Camera owner']) {
      camera.push({ k: 'Camera owner', v: e.exif['Camera owner'], note: 'Names the registered owner of the camera.' });
    }
    if (e.exif['ISO']) camera.push({ k: 'ISO', v: String(e.exif['ISO'][0] != null ? e.exif['ISO'][0] : e.exif['ISO']) });
    if (e.exif['F number']) camera.push({ k: 'Aperture', v: 'f/' + Number(e.exif['F number'][0]).toFixed(1) });
    if (e.exif['Exposure time']) {
      var et = Number(e.exif['Exposure time'][0]);
      camera.push({ k: 'Shutter', v: et >= 1 ? et + ' s' : '1/' + Math.round(1 / et) + ' s' });
    }
    if (e.exif['Focal length']) camera.push({ k: 'Focal length', v: Number(e.exif['Focal length'][0]).toFixed(0) + ' mm' });
    if (camera.length) report.groups.push({ name: 'Camera', icon: 'camera', rows: camera });

    var dates = [];
    if (e.exif['Date taken']) {
      dates.push({ k: 'Date taken', v: prettyExifDate(e.exif['Date taken']), note: 'When the shutter fired, according to the camera clock.' });
    }
    if (e.exif['Date digitised'] && e.exif['Date digitised'] !== e.exif['Date taken']) {
      dates.push({ k: 'Date digitised', v: prettyExifDate(e.exif['Date digitised']) });
    }
    if (e.ifd0['File changed']) dates.push({ k: 'File changed', v: prettyExifDate(e.ifd0['File changed']) });
    if (e.gps['GPS date']) {
      dates.push({
        k: 'GPS date', v: prettyExifDate(e.gps['GPS date'] + ' 00:00:00').replace(/ at .*/, ''),
        note: 'Supplied by the satellites, not by the camera clock. When the two disagree, the camera clock is the one that is wrong.'
      });
    }
    if (dates.length) report.groups.push({ name: 'Dates', icon: 'clock', rows: dates });

    /* GPS */
    var latRef = e.gps['Latitude ref'], lonRef = e.gps['Longitude ref'];
    var lat = dmsToDecimal(e.gps['Latitude'], latRef);
    var lon = dmsToDecimal(e.gps['Longitude'], lonRef);
    if (lat != null && lon != null && !(lat === 0 && lon === 0)) {
      report.gps = { lat: lat, lon: lon, label: lat.toFixed(6) + ', ' + lon.toFixed(6) };
      /* Show the magnitude with its hemisphere letter — "-97.12° W" reads as
         a double negative and confuses every room it is shown to. */
      var loc = [
        { k: 'Latitude', v: Math.abs(lat).toFixed(6) + '° ' + (latRef || (lat < 0 ? 'S' : 'N')) },
        { k: 'Longitude', v: Math.abs(lon).toFixed(6) + '° ' + (lonRef || (lon < 0 ? 'W' : 'E')) }
      ];
      if (e.gps['Altitude']) loc.push({ k: 'Altitude', v: Number(e.gps['Altitude'][0]).toFixed(0) + ' m' });
      if (e.gps['GPS time'] && e.gps['GPS time'].length >= 3) {
        var t = e.gps['GPS time'];
        loc.push({
          k: 'GPS time (UTC)',
          v: String(Math.floor(t[0])).padStart(2, '0') + ':' +
             String(Math.floor(t[1])).padStart(2, '0') + ':' +
             String(Math.floor(t[2])).padStart(2, '0')
        });
      }
      report.groups.push({ name: 'Location', icon: 'pin', rows: loc });
      report.flags.push({
        level: 'high',
        text: 'This photo carries exact GPS coordinates. Anyone who receives the file can place it on a map to within a few metres.'
      });
    }

    var authoring = [];
    if (e.ifd0['Software']) authoring.push({ k: 'Software', v: e.ifd0['Software'], note: 'Shows the file was processed, and by what.' });
    if (e.ifd0['Artist']) authoring.push({ k: 'Artist', v: e.ifd0['Artist'] });
    if (e.ifd0['Copyright']) authoring.push({ k: 'Copyright', v: e.ifd0['Copyright'] });
    if (e.ifd0['Description']) authoring.push({ k: 'Description', v: e.ifd0['Description'] });
    if (e.exif['User comment']) {
      var uc = e.exif['User comment'];
      if (typeof uc !== 'string') uc = uc.map(function (c) { return c > 31 && c < 127 ? String.fromCharCode(c) : ''; }).join('');
      if (uc.trim()) authoring.push({ k: 'User comment', v: uc.trim() });
    }
    if (comment) authoring.push({ k: 'JPEG comment', v: comment });
    if (authoring.length) report.groups.push({ name: 'Authoring', icon: 'pen', rows: authoring });

    var tech = [];
    if (dims) tech.push({ k: 'Dimensions', v: dims.w + ' × ' + dims.h + ' pixels' });
    else if (e.exif['Image width']) {
      tech.push({ k: 'Dimensions', v: e.exif['Image width'] + ' × ' + e.exif['Image height'] + ' pixels' });
    }
    if (e.ifd0['Orientation']) {
      var o = e.ifd0['Orientation'][0];
      tech.push({ k: 'Orientation', v: ORIENTATION[o] || String(o) });
    }
    if (hasApp13) tech.push({ k: 'IPTC block', v: 'Present', note: 'Photoshop caption and credit data is embedded.' });
    if (xmp) {
      var creator = /<dc:creator>[\s\S]*?<rdf:li[^>]*>([^<]+)</.exec(xmp);
      var tool = /xmp:CreatorTool="([^"]+)"/.exec(xmp) || /<xmp:CreatorTool>([^<]+)</.exec(xmp);
      if (creator) tech.push({ k: 'XMP creator', v: creator[1] });
      if (tool) tech.push({ k: 'XMP creator tool', v: tool[1] });
      if (!creator && !tool) tech.push({ k: 'XMP packet', v: 'Present' });
    }
    if (tech.length) report.groups.push({ name: 'Technical', icon: 'chip', rows: tech });

    if (!exifData || (!camera.length && !dates.length && !report.gps)) {
      report.flags.push({
        level: 'note',
        text: 'No camera EXIF found. Files that have been screenshotted, re-saved by many websites, or exported from a design tool usually arrive stripped like this.'
      });
    }
    return report;
  }

  /* --------------------------------------------------------------- PNG */

  async function readPng(file) {
    var buf = await readSlice(file, 0, Math.min(file.size, 1024 * 1024));
    var view = new DataView(buf);
    var report = { kind: 'png', groups: [], gps: null, flags: [], raw: {} };

    var offset = 8, tech = [], text = [];
    while (offset + 8 < view.byteLength) {
      var len = view.getUint32(offset, false);
      var type = ascii(view, offset + 4, 4);
      var dataStart = offset + 8;
      if (len > view.byteLength) break;

      if (type === 'IHDR') {
        tech.push({ k: 'Dimensions', v: view.getUint32(dataStart, false) + ' × ' + view.getUint32(dataStart + 4, false) + ' pixels' });
        tech.push({ k: 'Bit depth', v: String(view.getUint8(dataStart + 8)) });
      } else if (type === 'tEXt' || type === 'iTXt') {
        var chunk = latin(buf.slice(dataStart, dataStart + Math.min(len, 4000)));
        var nul = chunk.indexOf(' ');
        if (nul > 0) {
          var key = chunk.slice(0, nul);
          var val = chunk.slice(nul + 1).replace(/^[ -]+/, '').trim();
          if (val) text.push({ k: key, v: val.slice(0, 300) });
        }
      } else if (type === 'tIME') {
        tech.push({
          k: 'Last modified',
          v: view.getUint16(dataStart, false) + '-' +
             String(view.getUint8(dataStart + 2)).padStart(2, '0') + '-' +
             String(view.getUint8(dataStart + 3)).padStart(2, '0')
        });
      } else if (type === 'eXIf') {
        var e2 = parseTiff(view, dataStart);
        if (e2.ifd0['Camera model']) tech.push({ k: 'Camera model', v: e2.ifd0['Camera model'] });
      } else if (type === 'IEND') break;

      offset = dataStart + len + 4;
    }

    if (tech.length) report.groups.push({ name: 'Technical', icon: 'chip', rows: tech });
    if (text.length) report.groups.push({ name: 'Embedded text', icon: 'pen', rows: text });
    if (!text.length) {
      report.flags.push({
        level: 'note',
        text: 'PNG files carry far less than JPEGs. Screenshots in particular are usually clean — which is exactly why a screenshot of a document is not the same evidence as the document.'
      });
    }
    return report;
  }

  /* --------------------------------------------------------------- PDF */

  async function readPdf(file) {
    var cap = 8 * 1024 * 1024;
    var buf = await readSlice(file, 0, Math.min(file.size, cap));
    var text = latin(buf);
    var report = { kind: 'pdf', groups: [], gps: null, flags: [], raw: {} };

    /* A PDF that has been saved more than once contains several copies of the
       information dictionary, appended one after another. The LAST one is the
       live version — reading the first would report superseded values. */
    function grabAll(key) {
      var found = [], m;

      var re = new RegExp('\\/' + key + '\\s*\\(((?:\\\\.|[^\\\\()])*)\\)', 'g');
      while ((m = re.exec(text)) !== null) {
        found.push(m[1]
          .replace(/\\([()\\])/g, '$1')
          .replace(/\\(\d{3})/g, function (_, o) { return String.fromCharCode(parseInt(o, 8)); })
          .trim());
      }

      var reHex = new RegExp('\\/' + key + '\\s*<([0-9A-Fa-f\\s]+)>', 'g');
      while ((m = reHex.exec(text)) !== null) {
        var hex = m[1].replace(/\s/g, ''), out = '';
        if (hex.slice(0, 4).toUpperCase() === 'FEFF') {
          for (var i = 4; i + 3 < hex.length; i += 4) out += String.fromCharCode(parseInt(hex.substr(i, 4), 16));
        } else {
          for (var j = 0; j + 1 < hex.length; j += 2) out += String.fromCharCode(parseInt(hex.substr(j, 2), 16));
        }
        if (out.trim()) found.push(out.trim());
      }

      return found.filter(function (v) { return v !== ''; });
    }

    function grab(key) {
      var all = grabAll(key);
      return all.length ? all[all.length - 1] : null;
    }

    var doc = [], people = [], dates = [];

    var title = grab('Title'); if (title) doc.push({ k: 'Title', v: title });
    var subject = grab('Subject'); if (subject) doc.push({ k: 'Subject', v: subject });
    var keywords = grab('Keywords'); if (keywords) doc.push({ k: 'Keywords', v: keywords });

    var author = grab('Author');
    if (author) people.push({ k: 'Author', v: author, note: 'Carried over from whoever was signed in to the program that made it.' });
    var creator = grab('Creator');
    if (creator) people.push({ k: 'Created with', v: creator, note: 'The original authoring program.' });
    var producer = grab('Producer');
    if (producer) people.push({ k: 'Produced by', v: producer, note: 'The program that wrote the actual PDF — often reveals the conversion path.' });

    var cd = grab('CreationDate'); if (cd) dates.push({ k: 'Created', v: prettyPdfDate(cd) });
    var md = grab('ModDate'); if (md) dates.push({ k: 'Modified', v: prettyPdfDate(md) });

    /* Earlier, superseded dates still sitting in the file */
    var allMod = grabAll('ModDate').filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (allMod.length > 1) {
      dates.push({
        k: 'Earlier saved dates',
        v: allMod.slice(0, -1).map(prettyPdfDate).join('  ·  '),
        note: 'Superseded values still readable inside the file. Each one marks a save that was never fully discarded.'
      });
    }

    var ver = /^%PDF-(\d\.\d)/.exec(text);
    var tech = [];
    if (ver) tech.push({ k: 'PDF version', v: ver[1] });

    var pages = text.match(/\/Type\s*\/Page[^s]/g);
    if (pages) tech.push({ k: 'Pages (approx.)', v: String(pages.length) });

    if (/\/Encrypt\b/.test(text)) {
      tech.push({ k: 'Encryption', v: 'Present' });
      report.flags.push({ level: 'note', text: 'This PDF has an encryption dictionary — it may be password protected or permission restricted.' });
    }

    if (/\/Annots\b/.test(text)) tech.push({ k: 'Annotations', v: 'Present' });

    /* Redaction and revision hints */
    var incremental = (text.match(/%%EOF/g) || []).length;
    if (incremental > 1) {
      tech.push({ k: 'Saved revisions', v: String(incremental) });
      report.flags.push({
        level: 'high',
        text: 'This file has been saved ' + incremental + ' times inside the same document (incremental updates). Earlier versions of the content can still be sitting in the file below what you see.'
      });
    }

    /* XMP */
    var xmpMatch = /<x:xmpmeta[\s\S]{0,20000}?<\/x:xmpmeta>/.exec(text);
    if (xmpMatch) {
      var xm = xmpMatch[0];
      var tool = /<xmp:CreatorTool>([^<]+)</.exec(xm);
      var docId = /<xmpMM:DocumentID>([^<]+)</.exec(xm);
      if (tool && !creator) people.push({ k: 'XMP creator tool', v: tool[1] });
      if (docId) tech.push({ k: 'Document ID', v: docId[1], note: 'Persists across saves and links revisions of the same document together.' });
    }

    if (doc.length) report.groups.push({ name: 'Document', icon: 'doc', rows: doc });
    if (people.length) report.groups.push({ name: 'People and software', icon: 'pen', rows: people });
    if (dates.length) report.groups.push({ name: 'Dates', icon: 'clock', rows: dates });
    if (tech.length) report.groups.push({ name: 'Technical', icon: 'chip', rows: tech });

    if (file.size > cap) {
      report.flags.push({ level: 'note', text: 'Large file — only the first ' + fmtBytes(cap) + ' were scanned.' });
    }
    if (!doc.length && !people.length && !dates.length) {
      report.flags.push({ level: 'note', text: 'No document information dictionary found. Some generators write nothing at all, and some tools strip it deliberately.' });
    }
    return report;
  }

  /* ------------------------------------------------ Office files (ZIP) */

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('no DecompressionStream');
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function zipEntries(file) {
    /* Find the End Of Central Directory record near the end of the file */
    var tailLen = Math.min(file.size, 66000);
    var tail = new Uint8Array(await readSlice(file, file.size - tailLen, file.size));
    var eocd = -1;
    for (var i = tail.length - 22; i >= 0; i--) {
      if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not a zip');

    var dv = new DataView(tail.buffer, tail.byteOffset);
    var count = dv.getUint16(eocd + 10, true);
    var cdSize = dv.getUint32(eocd + 12, true);
    var cdOffset = dv.getUint32(eocd + 16, true);

    var cd = new Uint8Array(await readSlice(file, cdOffset, cdOffset + cdSize));
    var cdv = new DataView(cd.buffer, cd.byteOffset);
    var entries = [], p = 0;
    for (var n = 0; n < count && p + 46 <= cd.length; n++) {
      if (cdv.getUint32(p, true) !== 0x02014b50) break;
      var method = cdv.getUint16(p + 10, true);
      var compSize = cdv.getUint32(p + 20, true);
      var uncompSize = cdv.getUint32(p + 24, true);
      var nameLen = cdv.getUint16(p + 28, true);
      var extraLen = cdv.getUint16(p + 30, true);
      var commentLen = cdv.getUint16(p + 32, true);
      var localOffset = cdv.getUint32(p + 42, true);
      var name = utf8(cd.buffer.slice(cd.byteOffset + p + 46, cd.byteOffset + p + 46 + nameLen));
      entries.push({ name: name, method: method, compSize: compSize, size: uncompSize, offset: localOffset });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function zipRead(file, entry) {
    var head = new Uint8Array(await readSlice(file, entry.offset, entry.offset + 30));
    var hv = new DataView(head.buffer, head.byteOffset);
    if (hv.getUint32(0, true) !== 0x04034b50) throw new Error('bad local header');
    var nameLen = hv.getUint16(26, true);
    var extraLen = hv.getUint16(28, true);
    var start = entry.offset + 30 + nameLen + extraLen;
    var raw = new Uint8Array(await readSlice(file, start, start + entry.compSize));
    if (entry.method === 0) return raw;
    if (entry.method === 8) return inflateRaw(raw);
    throw new Error('unsupported compression');
  }

  async function readOffice(file) {
    var report = { kind: 'office', groups: [], gps: null, flags: [], raw: {} };
    var entries;
    try { entries = await zipEntries(file); }
    catch (e) {
      report.error = 'This file could not be opened as an Office package.';
      return report;
    }

    function find(name) {
      for (var i = 0; i < entries.length; i++) if (entries[i].name === name) return entries[i];
      return null;
    }

    function tagText(xml, tag) {
      var m = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>').exec(xml);
      if (!m) return null;
      var v = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
      return v || null;
    }

    var people = [], dates = [], doc = [], stats = [];

    var core = find('docProps/core.xml');
    if (core) {
      var xml = utf8((await zipRead(file, core)).buffer);
      var creator = tagText(xml, 'dc:creator');
      var modifier = tagText(xml, 'cp:lastModifiedBy');
      var title2 = tagText(xml, 'dc:title');
      var subj = tagText(xml, 'dc:subject');
      var desc = tagText(xml, 'dc:description');
      var kw = tagText(xml, 'cp:keywords');
      var cat = tagText(xml, 'cp:category');
      var rev = tagText(xml, 'cp:revision');
      var created = tagText(xml, 'dcterms:created');
      var modified = tagText(xml, 'dcterms:modified');
      var printed = tagText(xml, 'cp:lastPrinted');

      if (creator) people.push({ k: 'Original author', v: creator, note: 'The name registered in Word or Excel when the file was first created.' });
      if (modifier) {
        people.push({
          k: 'Last saved by', v: modifier,
          note: modifier !== creator
            ? 'Different from the original author — this file passed through another set of hands.'
            : 'Same person who created it.'
        });
      }
      if (rev) people.push({ k: 'Revision number', v: rev, note: 'How many times this document has been saved.' });
      if (title2) doc.push({ k: 'Title', v: title2 });
      if (subj) doc.push({ k: 'Subject', v: subj });
      if (desc) doc.push({ k: 'Comments', v: desc });
      if (kw) doc.push({ k: 'Keywords', v: kw });
      if (cat) doc.push({ k: 'Category', v: cat });
      if (created) dates.push({ k: 'Created', v: prettyIso(created) });
      if (modified) dates.push({ k: 'Last modified', v: prettyIso(modified) });
      if (printed) dates.push({ k: 'Last printed', v: prettyIso(printed), note: 'Yes — Office records when a document was printed.' });
    }

    var app = find('docProps/app.xml');
    if (app) {
      var axml = utf8((await zipRead(file, app)).buffer);
      var application = tagText(axml, 'Application');
      var company = tagText(axml, 'Company');
      var manager = tagText(axml, 'Manager');
      var totalTime = tagText(axml, 'TotalTime');
      var words = tagText(axml, 'Words');
      var pages2 = tagText(axml, 'Pages');
      var template = tagText(axml, 'Template');

      if (application) stats.push({ k: 'Application', v: application });
      if (company) people.push({ k: 'Company', v: company, note: 'Often still says the organisation that bought the licence.' });
      if (manager) people.push({ k: 'Manager', v: manager });
      if (template && template !== 'Normal.dotm') stats.push({ k: 'Template', v: template });
      if (totalTime && +totalTime > 0) {
        stats.push({ k: 'Total editing time', v: (+totalTime >= 60 ? Math.floor(+totalTime / 60) + ' h ' + (+totalTime % 60) + ' m' : totalTime + ' minutes'),
                     note: 'Total minutes the document was open for editing.' });
      }
      if (pages2) stats.push({ k: 'Pages', v: pages2 });
      if (words) stats.push({ k: 'Words', v: words });
    }

    /* Tracked changes and comments */
    var docXml = find('word/document.xml');
    var extras = [];
    if (docXml && docXml.size < 8 * 1024 * 1024) {
      try {
        var dtext = utf8((await zipRead(file, docXml)).buffer);
        var ins = (dtext.match(/<w:ins\b/g) || []).length;
        var del = (dtext.match(/<w:del\b/g) || []).length;
        if (ins || del) {
          extras.push({ k: 'Tracked changes', v: ins + ' insertions, ' + del + ' deletions' });
          report.flags.push({
            level: 'high',
            text: 'This document still contains tracked changes. Accepting all changes before sending is not the same as removing them — they live in the file until you do.'
          });
        }
        var authors = dtext.match(/w:author="([^"]*)"/g);
        if (authors) {
          var uniq = {};
          authors.forEach(function (a) { uniq[a.slice(10, -1)] = 1; });
          var names = Object.keys(uniq).filter(Boolean);
          if (names.length) {
            extras.push({ k: 'Named editors', v: names.join(', '), note: 'Every person whose edits or comments are recorded in the file.' });
          }
        }
      } catch (e) { /* not fatal */ }
    }
    if (find('word/comments.xml')) {
      extras.push({ k: 'Comments file', v: 'Present' });
      report.flags.push({ level: 'high', text: 'There are review comments stored in this document.' });
    }

    var hidden = [];
    for (var q = 0; q < entries.length; q++) {
      var n2 = entries[q].name;
      if (/^word\/embeddings\//.test(n2) || /^xl\/embeddings\//.test(n2)) hidden.push(n2.split('/').pop());
    }
    if (hidden.length) {
      extras.push({ k: 'Embedded files', v: hidden.join(', ') });
      report.flags.push({ level: 'high', text: 'Whole files are embedded inside this document. They travel with it and they are rarely noticed.' });
    }

    if (people.length) report.groups.push({ name: 'People', icon: 'pen', rows: people });
    if (dates.length) report.groups.push({ name: 'Dates', icon: 'clock', rows: dates });
    if (doc.length) report.groups.push({ name: 'Document', icon: 'doc', rows: doc });
    if (stats.length) report.groups.push({ name: 'Application', icon: 'chip', rows: stats });
    if (extras.length) report.groups.push({ name: 'Revision traces', icon: 'alert', rows: extras });

    report.groups.push({
      name: 'Package', icon: 'zip',
      rows: [{ k: 'Parts inside the file', v: String(entries.length),
               note: 'An Office file is a ZIP archive. Everything above was read out of the parts inside it.' }]
    });
    return report;
  }

  /* --------------------------------------------------------- dispatcher */

  async function read(file) {
    var report;
    var base = {
      file: {
        name: file.name,
        size: file.size,
        sizeLabel: fmtBytes(file.size),
        type: file.type || 'unknown',
        lastModified: file.lastModified ? new Date(file.lastModified) : null
      },
      groups: [], gps: null, flags: [], kind: 'unknown', error: null
    };

    try {
      var head = new Uint8Array(await readSlice(file, 0, 8));
      var isJpeg = head[0] === 0xff && head[1] === 0xd8;
      var isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
      var isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
      var isZip = head[0] === 0x50 && head[1] === 0x4b;

      if (isJpeg) report = await readJpeg(file);
      else if (isPng) report = await readPng(file);
      else if (isPdf) report = await readPdf(file);
      else if (isZip) report = await readOffice(file);
      else {
        report = { kind: 'unknown', groups: [], gps: null, flags: [
          { level: 'note', text: 'This file type is not one the inspector reads in detail. The system properties below still apply to every file.' }
        ] };
      }
    } catch (err) {
      report = { kind: 'unknown', groups: [], gps: null, flags: [], error: 'Could not read this file: ' + err.message };
    }

    base.kind = report.kind;
    base.groups = report.groups;
    base.gps = report.gps;
    base.flags = report.flags;
    base.error = report.error || null;

    /* Every file has these, whatever it is */
    base.groups.push({
      name: 'System properties', icon: 'file',
      rows: [
        { k: 'File name', v: file.name, note: 'Names leak too. "Smith_v_Acme_DRAFT_v7_FINAL_rev.docx" tells a story.' },
        { k: 'File size', v: fmtBytes(file.size) },
        { k: 'Reported type', v: file.type || 'not reported by the browser' },
        { k: 'Modified on this device', v: file.lastModified ? new Date(file.lastModified).toLocaleString() : 'unknown',
          note: 'Set by the computer holding the file — it changes when the file is copied or downloaded.' }
      ]
    });

    return base;
  }

  /* Re-encode an image through a canvas. Everything except the pixels is lost,
     which is the simplest honest way to show what stripping actually does. */
  function stripImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob); else reject(new Error('could not re-encode'));
        }, 'image/jpeg', 0.92);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('could not load image')); };
      img.src = url;
    });
  }

  root.MCCMeta = { read: read, stripImage: stripImage, fmtBytes: fmtBytes };

})(typeof window !== 'undefined' ? window : globalThis);
