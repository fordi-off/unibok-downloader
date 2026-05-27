// unibok-downloader.js
// Hosted on GitHub — loaded by Tampermonkey via @require
// https://github.com/YOUR_USERNAME/unibok-downloader

(function () {
  'use strict';

  // ── Styles ────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #ub-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      background: #2e7d32; color: #fff; border: none; border-radius: 8px;
      padding: 12px 20px; font-size: 15px; font-weight: bold;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: sans-serif; transition: background 0.2s;
    }
    #ub-btn:hover { background: #1b5e20; }
    #ub-btn:disabled { background: #555; cursor: default; }

    #ub-overlay {
      display: none; position: fixed; inset: 0; z-index: 9999998;
      background: rgba(0,0,0,0.55); align-items: center; justify-content: center;
    }
    #ub-overlay.open { display: flex; }

    #ub-modal {
      background: #fff; border-radius: 12px; padding: 28px;
      max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      font-family: sans-serif; max-height: 80vh; display: flex; flex-direction: column;
    }
    #ub-modal h2 { margin: 0 0 6px; color: #2e7d32; font-size: 18px; }
    #ub-modal p  { margin: 0 0 16px; color: #666; font-size: 13px; }

    #ub-list {
      overflow-y: auto; flex: 1; border: 1px solid #e0e0e0;
      border-radius: 8px; margin-bottom: 16px;
    }
    .ub-book-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid #f0f0f0;
      cursor: pointer; transition: background 0.15s;
    }
    .ub-book-item:last-child { border-bottom: none; }
    .ub-book-item:hover { background: #f1f8e9; }
    .ub-book-item .ub-book-name { font-weight: bold; font-size: 14px; color: #222; }
    .ub-book-item .ub-book-meta { font-size: 12px; color: #888; margin-top: 2px; }
    .ub-book-item .ub-dl-btn {
      background: #2e7d32; color: #fff; border: none; border-radius: 6px;
      padding: 7px 14px; font-size: 13px; cursor: pointer; white-space: nowrap;
      margin-left: 12px; flex-shrink: 0;
    }
    .ub-book-item .ub-dl-btn:hover { background: #1b5e20; }
    .ub-book-item .ub-dl-btn:disabled { background: #aaa; cursor: default; }

    #ub-close {
      background: #eee; border: none; border-radius: 6px; padding: 9px 18px;
      font-size: 14px; cursor: pointer; align-self: flex-end;
    }
    #ub-close:hover { background: #ddd; }
    #ub-scanning { padding: 20px; text-align: center; color: #666; font-size: 14px; }
  `;
  document.head.appendChild(style);

  // ── HTML structure ────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'ub-overlay';
  overlay.innerHTML = `
    <div id="ub-modal">
      <h2>📚 Available Books</h2>
      <p>Only books downloaded for offline use are shown here.</p>
      <div id="ub-list"><div id="ub-scanning">⏳ Scanning storage...</div></div>
      <button id="ub-close">Close</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const btn = document.createElement('button');
  btn.id = 'ub-btn';
  btn.textContent = '📚 Download Book';
  document.body.appendChild(btn);

  // ── Events ────────────────────────────────────────────────────────────────
  btn.onclick = () => openModal();
  document.getElementById('ub-close').onclick = () => overlay.classList.remove('open');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };

  // ── Scan available books ──────────────────────────────────────────────────
  async function openModal() {
    overlay.classList.add('open');
    const list = document.getElementById('ub-list');
    list.innerHTML = '<div id="ub-scanning">⏳ Scanning storage...</div>';

    const books = await findAvailableBooks();
    list.innerHTML = '';

    if (!books.length) {
      list.innerHTML = '<div id="ub-scanning">No books found. Download a book for offline use first (the cloud icon in the reader).</div>';
      return;
    }

    for (const book of books) {
      const item = document.createElement('div');
      item.className = 'ub-book-item';
      item.innerHTML = `
        <div>
          <div class="ub-book-name">${book.title || book.id}</div>
          <div class="ub-book-meta">${book.id} &nbsp;·&nbsp; ${book.count} files</div>
        </div>
        <button class="ub-dl-btn">⬇ Download</button>
      `;
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
        if (!storeNames.includes('keyvaluepairs')) { db.close(); continue; }

        const count = await countRecords(db, 'keyvaluepairs');
        if (count === 0) { db.close(); continue; }

        const title = await getBookTitle(db);
        db.close();

        books.push({
          id:     dbInfo.name.replace('bookId_', ''),
          dbName: dbInfo.name,
          count,
          title,
        });
      } catch { /* skip broken DBs */ }
    }

    return books.sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  }

  async function getBookTitle(db) {
    return new Promise(res => {
      const req = db.transaction('keyvaluepairs', 'readonly').objectStore('keyvaluepairs').openCursor();
      req.onsuccess = async e => {
        const c = e.target.result;
        if (!c) { res(null); return; }
        if (c.key.endsWith('.opf')) {
          try {
            const text = await decodeVal(c.value);
            const doc = new DOMParser().parseFromString(text, 'application/xml');
            res(doc.querySelector('title')?.textContent || null);
          } catch { res(null); }
        } else {
          c.continue();
        }
      };
      req.onerror = () => res(null);
    });
  }

  // ── Download a specific book ──────────────────────────────────────────────
  async function downloadBook(book, dlBtn) {
    dlBtn.disabled = true;
    dlBtn.textContent = '⏳ Opening...';

    try {
      const db = await openDb(book.dbName);
      dlBtn.textContent = '⏳ Reading files...';
      const records = await getAllRecords(db, 'keyvaluepairs');
      db.close();

      const opfKey = Object.keys(records).find(k =>
        k.endsWith('.opf') || k.includes('content.opf') || k.includes('package.opf')
      );

      let spineOrder = [];
      let bookTitle = book.title || book.id;

      if (opfKey) {
        const opfText = await decodeVal(records[opfKey]);
        const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml');
        const t = opfDoc.querySelector('title')?.textContent;
        if (t) bookTitle = t;

        const manifest = {};
        opfDoc.querySelectorAll('manifest item').forEach(item => {
          manifest[item.getAttribute('id')] = item.getAttribute('href');
        });
        opfDoc.querySelectorAll('spine itemref').forEach(ref => {
          const href = manifest[ref.getAttribute('idref')];
          if (href) spineOrder.push(href);
        });
      }

      if (!spineOrder.length) {
        spineOrder = Object.keys(records)
          .filter(k => k.match(/\.(xhtml|html|htm)$/i))
          .sort();
      }

      const parser = new DOMParser();
      let html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>${bookTitle}</title>
<style>
  body { font-family: Georgia, serif; max-width: 820px; margin: 40px auto;
         line-height: 1.8; font-size: 18px; color: #222; padding: 0 24px; }
  h1,h2,h3,h4 { font-family: sans-serif; margin-top: 2em; }
  p { margin: 0.9em 0; }
  hr.ch { border: none; border-top: 2px solid #ddd; margin: 3em 0; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td,th { border: 1px solid #ccc; padding: 6px 10px; }
</style></head><body>
<h1 style="text-align:center;color:#2e7d32">${bookTitle}</h1>\n`;

      for (let i = 0; i < spineOrder.length; i++) {
        const href = spineOrder[i];
        dlBtn.textContent = `⏳ Chapter ${i + 1} / ${spineOrder.length}`;

        const matchKey = Object.keys(records).find(k =>
          k.endsWith('/' + href) || k.endsWith(href)
        );
        if (!matchKey || !records[matchKey]) continue;

        const text = await decodeVal(records[matchKey]);
        const doc = parser.parseFromString(text, 'text/html');
        doc.querySelectorAll('script, style, nav, [aria-hidden="true"]').forEach(el => el.remove());
        html += `<hr class="ch">\n${doc.body?.innerHTML ?? ''}\n`;
      }

      html += '</body></html>';

      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${bookTitle.replace(/[^\w\s-]/g, '_')}.html`;
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
      setTimeout(() => { dlBtn.textContent = '⬇ Download'; dlBtn.disabled = false; }, 3000);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
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
    } catch { res(0); }
  });

  const getAllRecords = (db, store) => new Promise((res, rej) => {
    const all = {};
    const req = db.transaction(store, 'readonly').objectStore(store).openCursor();
    req.onsuccess = e => {
      const c = e.target.result;
      if (c) { all[c.key] = c.value; c.continue(); } else res(all);
    };
    req.onerror = rej;
  });

  const decodeVal = async val => {
    if (typeof val === 'string') return val;
    if (val instanceof Blob) return val.text();
    if (val instanceof ArrayBuffer) return new TextDecoder().decode(val);
    if (val?.buffer) return new TextDecoder().decode(val);
    return String(val);
  };

})();
