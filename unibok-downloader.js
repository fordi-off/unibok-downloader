// unibok-downloader.js
// Hosted on GitHub — loaded by Tampermonkey via @require
// Version with offline images and stylesheet support
(function () {
  'use strict';

  // ── UI styles ───────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #ub-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #2e7d32;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 15px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: sans-serif;
      transition: background 0.2s;
    }
    #ub-btn:hover { background: #1b5e20; }
    #ub-btn:disabled { background: #555; cursor: default; }
    #ub-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999998;
      background: rgba(0,0,0,0.55);
      align-items: center;
      justify-content: center;
    }
    #ub-overlay.open { display: flex; }
    #ub-modal {
      background: #fff;
      border-radius: 12px;
      padding: 28px;
      max-width: 520px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      font-family: sans-serif;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }
    #ub-modal h2 { margin: 0 0 6px; color: #2e7d32; font-size: 18px; }
    #ub-modal p { margin: 0 0 16px; color: #666; font-size: 13px; }
    #ub-list { overflow-y: auto; flex: 1; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 16px; }
    .ub-book-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background 0.15s; }
    .ub-book-item:last-child { border-bottom: none; }
    .ub-book-item:hover { background: #f1f8e9; }
    .ub-book-name { font-weight: bold; font-size: 14px; color: #222; }
    .ub-book-meta { font-size: 12px; color: #888; margin-top: 2px; }
    .ub-dl-btn { background: #2e7d32; color: #fff; border: none; border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer; white-space: nowrap; margin-left: 12px; flex-shrink: 0; }
    .ub-dl-btn:hover { background: #1b5e20; }
    .ub-dl-btn:disabled { background: #aaa; cursor: default; }
    #ub-close { background: #eee; border: none; border-radius: 6px; padding: 9px 18px; font-size: 14px; cursor: pointer; align-self: flex-end; }
    #ub-close:hover { background: #ddd; }
    #ub-scanning { padding: 20px; text-align: center; color: #666; font-size: 14px; }
  `;
  document.head.appendChild(style);

  // ── UI structure ────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'ub-overlay';
  overlay.innerHTML = `
    <div id="ub-modal">
      <h2>Available Books</h2>
      <p>Only books downloaded for offline use are shown here.</p>
      <div id="ub-list"><div id="ub-scanning">⏳ Scanning storage...</div></div>
      <button id="ub-close">Close</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const btn = document.createElement('button');
  btn.id = 'ub-btn';
  btn.textContent = 'Download Book';
  document.body.appendChild(btn);

  btn.onclick = () => openModal();
  document.getElementById('ub-close').onclick = () => overlay.classList.remove('open');
  overlay.onclick = e => {
    if (e.target === overlay) overlay.classList.remove('open');
  };

  // ── Scan available books ────────────────────────────────────────────────
  async function openModal() {
    overlay.classList.add('open');
    const list = document.getElementById('ub-list');
    list.innerHTML = '<div id="ub-scanning">⏳ Scanning storage...</div>';

    const books = await findAvailableBooks();
    list.innerHTML = '';

    if (!books.length) {
      list.innerHTML = '<div id="ub-scanning">No books found. Download a book for offline use first.</div>';
      return;
    }

    for (const book of books) {
      const item = document.createElement('div');
      item.className = 'ub-book-item';
      item.innerHTML = `
        <div>
          <div class="ub-book-name"></div>
          <div class="ub-book-meta"></div>
        </div>
        <button class="ub-dl-btn">⬇ Download</button>
      `;
      item.querySelector('.ub-book-name').textContent = book.title || book.id;
      item.querySelector('.ub-book-meta').textContent = `${book.id} · ${book.count} files`;
      item.querySelector('.ub-dl-btn').onclick = (e) => {
        e.stopPropagation();
        downloadBook(book, item.querySelector('.ub-dl-btn'));
      };
      list.appendChild(item);
    }
  }

  async function findAvailableBooks() {
    const allDbs = await indexedDB.databases();
    const books = [];

    for (const dbInfo of allDbs) {
      if (!dbInfo.name?.startsWith('bookId_')) continue;
      try {
        const db = await openDb(dbInfo.name);
        const storeNames = Array.from(db.objectStoreNames);
        if (!storeNames.includes('keyvaluepairs')) {
          db.close();
          continue;
        }

        const count = await countRecords(db, 'keyvaluepairs');
        if (count === 0) {
          db.close();
          continue;
        }

        const title = await getBookTitle(db);
        db.close();

        books.push({
          id: dbInfo.name.replace('bookId_', ''),
          dbName: dbInfo.name,
          count,
          title,
        });
      } catch (err) {
        console.warn('[Unibok DL] Skipping DB', dbInfo.name, err);
      }
    }

    return books.sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  }

  async function getBookTitle(db) {
    return new Promise(res => {
      const req = db.transaction('keyvaluepairs', 'readonly').objectStore('keyvaluepairs').openCursor();
      req.onsuccess = async e => {
        const c = e.target.result;
        if (!c) return res(null);

        if (String(c.key).endsWith('.opf')) {
          try {
            const text = await decodeVal(c.value);
            const doc = new DOMParser().parseFromString(text, 'application/xml');
            res(doc.querySelector('title')?.textContent || null);
          } catch {
            res(null);
          }
        } else {
          c.continue();
        }
      };
      req.onerror = () => res(null);
    });
  }

  // ── Download a specific book ────────────────────────────────────────────
  async function downloadBook(book, dlBtn) {
    dlBtn.disabled = true;
    dlBtn.textContent = '⏳ Opening...';

    try {
      const db = await openDb(book.dbName);
      dlBtn.textContent = '⏳ Reading files...';
      const records = await getAllRecords(db, 'keyvaluepairs');
      db.close();

      const keys = Object.keys(records);
      const opfKey = keys.find(k => /\.opf$/i.test(k) || /content\.opf$/i.test(k) || /package\.opf$/i.test(k));
      const parser = new DOMParser();

      let bookTitle = book.title || book.id;
      let spineOrder = [];
      let globalCssHrefs = [];

      if (opfKey) {
        const opfText = await decodeVal(records[opfKey]);
        const opfDoc = parser.parseFromString(opfText, 'application/xml');
        const t = opfDoc.querySelector('title')?.textContent;
        if (t) bookTitle = t;

        const manifest = {};
        opfDoc.querySelectorAll('manifest item').forEach(item => {
          const id = item.getAttribute('id');
          const href = item.getAttribute('href');
          const mediaType = item.getAttribute('media-type') || '';
          if (id && href) manifest[id] = { href, mediaType };
          if (href && /text\/css/i.test(mediaType)) globalCssHrefs.push(resolvePath(dirname(opfKey), href));
        });

        opfDoc.querySelectorAll('spine itemref').forEach(ref => {
          const item = manifest[ref.getAttribute('idref')];
          if (item?.href) spineOrder.push(resolvePath(dirname(opfKey), item.href));
        });
      }

      if (!spineOrder.length) {
        spineOrder = keys.filter(k => /\.(xhtml|html|htm)$/i.test(k)).sort();
      }

      // Remove duplicated CSS hrefs.
      globalCssHrefs = [...new Set(globalCssHrefs)];

      dlBtn.textContent = '⏳ Building CSS...';
      const globalCss = [];
      for (const cssKey of globalCssHrefs) {
        const realCssKey = findRecordKey(records, cssKey);
        if (!realCssKey) continue;
        const cssText = await decodeVal(records[realCssKey]);
        globalCss.push(await rewriteCssUrls(cssText, dirname(realCssKey), records));
      }

      let bodyHtml = '';
      for (let i = 0; i < spineOrder.length; i++) {
        dlBtn.textContent = `⏳ Chapter ${i + 1} / ${spineOrder.length}`;

        const chapterKey = findRecordKey(records, spineOrder[i]);
        if (!chapterKey || !records[chapterKey]) continue;

        const text = await decodeVal(records[chapterKey]);
        const doc = parser.parseFromString(text, 'text/html');
        await rewriteDocumentAssets(doc, chapterKey, records, globalCss);

        // Keep CSS and content, but remove scripts. Scripts usually break outside Unibok.
        doc.querySelectorAll('script').forEach(el => el.remove());

        bodyHtml += `\n<section class="ub-chapter" data-source="${escapeHtml(chapterKey)}">\n${doc.body?.innerHTML ?? ''}\n</section>\n`;
      }

      const finalHtml = `<!doctype html>
<html lang="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(bookTitle)}</title>
  <style>
    ${baseExportCss()}
    ${globalCss.join('\n\n')}
  </style>
</head>
<body>
  <main id="book">
    <h1>${escapeHtml(bookTitle)}</h1>
    ${bodyHtml}
  </main>
</body>
</html>`;

      const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${safeFileName(bookTitle)}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);

      dlBtn.textContent = '✅ Done!';
      dlBtn.style.background = '#1565c0';
      setTimeout(() => {
        dlBtn.textContent = '⬇ Download';
        dlBtn.style.background = '';
        dlBtn.disabled = false;
      }, 4000);
    } catch (err) {
      console.error('[Unibok DL]', err);
      dlBtn.textContent = '❌ Error';
      setTimeout(() => {
        dlBtn.textContent = '⬇ Download';
        dlBtn.disabled = false;
      }, 3000);
    }
  }

  // ── Asset rewriting ─────────────────────────────────────────────────────
  async function rewriteDocumentAssets(doc, chapterKey, records, globalCss) {
    const chapterDir = dirname(chapterKey);

    // Inline chapter-specific stylesheet links.
    const stylesheetLinks = Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'));
    for (const link of stylesheetLinks) {
      const href = cleanUrl(link.getAttribute('href'));
      const cssKey = findRecordKey(records, resolvePath(chapterDir, href));
      if (cssKey) {
        const cssText = await decodeVal(records[cssKey]);
        const rewrittenCss = await rewriteCssUrls(cssText, dirname(cssKey), records);
        globalCss.push(rewrittenCss);
      }
      link.remove();
    }

    // Rewrite <style> url(...) references.
    for (const styleEl of Array.from(doc.querySelectorAll('style'))) {
      styleEl.textContent = await rewriteCssUrls(styleEl.textContent || '', chapterDir, records);
    }

    // Rewrite normal images.
    for (const img of Array.from(doc.querySelectorAll('img[src]'))) {
      await rewriteUrlAttribute(img, 'src', chapterDir, records);
    }

    // Rewrite responsive images.
    for (const el of Array.from(doc.querySelectorAll('source[srcset], img[srcset]'))) {
      const srcset = el.getAttribute('srcset');
      if (srcset) el.setAttribute('srcset', await rewriteSrcset(srcset, chapterDir, records));
    }

    // Rewrite SVG image hrefs.
    for (const el of Array.from(doc.querySelectorAll('image[href], image[xlink\\:href]'))) {
      if (el.hasAttribute('href')) await rewriteUrlAttribute(el, 'href', chapterDir, records);
      if (el.hasAttribute('xlink:href')) await rewriteUrlAttribute(el, 'xlink:href', chapterDir, records);
    }

    // Rewrite poster images on videos if present.
    for (const video of Array.from(doc.querySelectorAll('video[poster]'))) {
      await rewriteUrlAttribute(video, 'poster', chapterDir, records);
    }

    // Make internal anchor links not point to missing files.
    for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
      const href = a.getAttribute('href');
      if (!href || isExternalOrDataUrl(href) || href.startsWith('#')) continue;
      const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
      a.setAttribute('href', hash || '#');
    }
  }

  async function rewriteUrlAttribute(el, attr, baseDir, records) {
    const original = el.getAttribute(attr);
    if (!original || isExternalOrDataUrl(original)) return;

    const dataUrl = await recordToDataUrlByHref(original, baseDir, records);
    if (dataUrl) el.setAttribute(attr, dataUrl);
  }

  async function rewriteSrcset(srcset, baseDir, records) {
    const parts = srcset.split(',').map(part => part.trim()).filter(Boolean);
    const rewritten = [];

    for (const part of parts) {
      const [url, ...descriptor] = part.split(/\s+/);
      if (isExternalOrDataUrl(url)) {
        rewritten.push(part);
        continue;
      }
      const dataUrl = await recordToDataUrlByHref(url, baseDir, records);
      rewritten.push(`${dataUrl || url}${descriptor.length ? ' ' + descriptor.join(' ') : ''}`);
    }

    return rewritten.join(', ');
  }

  async function rewriteCssUrls(cssText, baseDir, records) {
    const urlRegex = /url\((['"]?)([^'"()]+)\1\)/gi;
    const matches = [...cssText.matchAll(urlRegex)];
    let rewritten = cssText;

    for (const match of matches) {
      const full = match[0];
      const url = match[2].trim();
      if (!url || isExternalOrDataUrl(url) || url.startsWith('#')) continue;

      const dataUrl = await recordToDataUrlByHref(url, baseDir, records);
      if (dataUrl) rewritten = rewritten.replace(full, `url("${dataUrl}")`);
    }

    // Basic @import support for local CSS files.
    const importRegex = /@import\s+(?:url\()?['"]?([^'"\);]+)['"]?\)?\s*;/gi;
    const imports = [...rewritten.matchAll(importRegex)];
    for (const match of imports) {
      const full = match[0];
      const href = match[1].trim();
      if (isExternalOrDataUrl(href)) continue;

      const cssKey = findRecordKey(records, resolvePath(baseDir, href));
      if (!cssKey) continue;
      const importedCss = await decodeVal(records[cssKey]);
      const fixedImportedCss = await rewriteCssUrls(importedCss, dirname(cssKey), records);
      rewritten = rewritten.replace(full, fixedImportedCss);
    }

    return rewritten;
  }

  async function recordToDataUrlByHref(href, baseDir, records) {
    const clean = cleanUrl(href);
    const wanted = resolvePath(baseDir, clean);
    const key = findRecordKey(records, wanted);
    if (!key) return null;
    return valueToDataUrl(records[key], mimeFromPath(key));
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const openDb = name => new Promise((res, rej) => {
    const req = indexedDB.open(name);
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });

  const countRecords = (db, store) => new Promise(res => {
    try {
      const req = db.transaction(store, 'readonly').objectStore(store).count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(0);
    } catch {
      res(0);
    }
  });

  const getAllRecords = (db, store) => new Promise((res, rej) => {
    const all = {};
    const req = db.transaction(store, 'readonly').objectStore(store).openCursor();
    req.onsuccess = e => {
      const c = e.target.result;
      if (c) {
        all[String(c.key)] = c.value;
        c.continue();
      } else {
        res(all);
      }
    };
    req.onerror = rej;
  });

  async function decodeVal(val) {
    if (typeof val === 'string') return val;
    if (val instanceof Blob) return val.text();
    if (val instanceof ArrayBuffer) return new TextDecoder().decode(val);
    if (ArrayBuffer.isView(val)) return new TextDecoder().decode(val);
    if (val?.buffer instanceof ArrayBuffer) return new TextDecoder().decode(val.buffer);
    return String(val);
  }

  async function valueToDataUrl(val, mime) {
    const blob = val instanceof Blob
      ? val
      : val instanceof ArrayBuffer
        ? new Blob([val], { type: mime })
        : ArrayBuffer.isView(val)
          ? new Blob([val.buffer], { type: mime })
          : typeof val === 'string'
            ? new Blob([val], { type: mime })
            : new Blob([String(val)], { type: mime });

    const finalBlob = blob.type ? blob : blob.slice(0, blob.size, mime);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(finalBlob);
    });
  }

  function findRecordKey(records, wantedPath) {
    const keys = Object.keys(records);
    const wanted = normalizePath(cleanUrl(wantedPath));
    const wantedLower = wanted.toLowerCase();

    return keys.find(k => normalizePath(k).toLowerCase() === wantedLower)
      || keys.find(k => normalizePath(k).toLowerCase().endsWith('/' + wantedLower))
      || keys.find(k => normalizePath(k).toLowerCase().endsWith(wantedLower));
  }

  function cleanUrl(url) {
    try {
      return decodeURIComponent(String(url).split('#')[0].split('?')[0]);
    } catch {
      return String(url).split('#')[0].split('?')[0];
    }
  }

  function isExternalOrDataUrl(url) {
    return /^(https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(String(url).trim());
  }

  function dirname(path) {
    const clean = normalizePath(path);
    const idx = clean.lastIndexOf('/');
    return idx >= 0 ? clean.slice(0, idx) : '';
  }

  function resolvePath(baseDir, relativePath) {
    const rel = cleanUrl(relativePath);
    if (!rel || rel.startsWith('/')) return normalizePath(rel.replace(/^\/+/, ''));
    return normalizePath(`${baseDir}/${rel}`);
  }

  function normalizePath(path) {
    const parts = String(path).replace(/\\/g, '/').split('/');
    const out = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    return out.join('/');
  }

  function mimeFromPath(path) {
    const ext = path.split('.').pop().toLowerCase();
    const map = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      avif: 'image/avif',
      css: 'text/css',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      otf: 'font/otf',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      m4a: 'audio/mp4',
      html: 'text/html',
      htm: 'text/html',
      xhtml: 'application/xhtml+xml',
    };
    return map[ext] || 'application/octet-stream';
  }

  function safeFileName(name) {
    return String(name).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'unibok';
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function baseExportCss() {
    return `
      html { background: #f5f5f5; }
      body {
        margin: 0;
        padding: 24px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.55;
        color: #111;
      }
      #book {
        max-width: 980px;
        margin: 0 auto;
        background: white;
        padding: 32px;
        box-shadow: 0 2px 18px rgba(0,0,0,.08);
      }
      img, svg, video, audio, canvas {
        max-width: 100%;
        height: auto;
      }
      .ub-chapter {
        margin-top: 32px;
        padding-top: 24px;
        border-top: 1px solid #ddd;
      }
      @media print {
        html { background: white; }
        body { padding: 0; }
        #book { box-shadow: none; max-width: none; padding: 0; }
      }
    `;
  }
})();
