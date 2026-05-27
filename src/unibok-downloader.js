(function () {
  "use strict";

  // =======================================================
  // SETUP VARIABLES
  // =======================================================

  const SETUP = {
    buttonText: "Download Unibok book",
    modalTitle: "Available Unibok offline books",
    loadedFlag: "__unibokExporterLoaded",
    buttonRight: "24px",
    buttonBottom: "24px",
    buttonZIndex: "999999"
  };

  const MODES = {
    AI: "ai",
    READER: "reader"
  };

  // =======================================================
  // INIT
  // =======================================================

  if (window[SETUP.loadedFlag]) {
    console.log("Unibok exporter is already loaded.");
    return;
  }

  window[SETUP.loadedFlag] = true;
  waitForBody(initUi);

  function waitForBody(callback) {
    if (document.body) callback();
    else setTimeout(() => waitForBody(callback), 300);
  }

  function initUi() {
    injectStyles();
    createModal();
    createMainButton();
    console.log("Unibok exporter loaded.");
  }

  function injectStyles() {
    if (document.getElementById("ub-exporter-styles")) return;

    const style = document.createElement("style");
    style.id = "ub-exporter-styles";
    style.textContent = `
      #ub-exporter-button {
        position: fixed;
        right: ${SETUP.buttonRight};
        bottom: ${SETUP.buttonBottom};
        z-index: ${SETUP.buttonZIndex};
        padding: 12px 16px;
        border: none;
        border-radius: 12px;
        background: #2e7d32;
        color: #fff;
        font: 700 14px Arial, sans-serif;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,.25);
      }
      #ub-exporter-button:hover { background: #1b5e20; }
      #ub-exporter-overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 9999998;
        background: rgba(0,0,0,.55);
        align-items: center;
        justify-content: center;
      }
      #ub-exporter-overlay.open { display: flex; }
      #ub-exporter-modal {
        width: min(760px, 94vw);
        max-height: 84vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: #fff;
        border-radius: 14px;
        padding: 24px;
        box-shadow: 0 8px 32px rgba(0,0,0,.3);
        font-family: Arial, sans-serif;
      }
      #ub-exporter-modal h2 { margin: 0 0 6px; font-size: 20px; color: #2e7d32; }
      #ub-exporter-modal p { margin: 0 0 16px; color: #555; font-size: 13px; line-height: 1.45; }
      #ub-exporter-list { overflow: auto; border: 1px solid #ddd; border-radius: 10px; margin-bottom: 16px; }
      .ub-exporter-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; padding: 12px 14px; border-bottom: 1px solid #eee; }
      .ub-exporter-row:last-child { border-bottom: none; }
      .ub-exporter-row:hover { background: #f1f8e9; }
      .ub-exporter-title { font-weight: 700; color: #222; }
      .ub-exporter-meta { margin-top: 3px; font-size: 12px; color: #777; }
      .ub-exporter-action { border: none; border-radius: 8px; padding: 8px 12px; color: white; font-weight: 700; cursor: pointer; white-space: nowrap; }
      .ub-exporter-action.ai { background: #1565c0; }
      .ub-exporter-action.reader { background: #2e7d32; }
      .ub-exporter-action:disabled { background: #aaa !important; cursor: default; }
      #ub-exporter-close { align-self: flex-end; border: none; border-radius: 8px; padding: 9px 18px; cursor: pointer; background: #eee; }
      #ub-exporter-empty { padding: 20px; text-align: center; color: #666; }
    `;

    document.head.appendChild(style);
  }

  function createModal() {
    if (document.getElementById("ub-exporter-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "ub-exporter-overlay";
    overlay.innerHTML = `
      <div id="ub-exporter-modal">
        <h2>${escapeHtml(SETUP.modalTitle)}</h2>
        <p>
          This exporter reads books that are already available in the browser's Unibok offline storage.
          Use it only for material you are allowed to access and export.
        </p>
        <div id="ub-exporter-list"><div id="ub-exporter-empty">Scanning storage...</div></div>
        <button id="ub-exporter-close">Close</button>
      </div>
    `;

    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.classList.remove("open");
    });

    document.body.appendChild(overlay);
    document.getElementById("ub-exporter-close").addEventListener("click", () => overlay.classList.remove("open"));
  }

  function createMainButton() {
    if (document.getElementById("ub-exporter-button")) return;

    const button = document.createElement("button");
    button.id = "ub-exporter-button";
    button.textContent = SETUP.buttonText;
    button.addEventListener("click", openModal);
    document.body.appendChild(button);
  }

  async function openModal() {
    const overlay = document.getElementById("ub-exporter-overlay");
    const list = document.getElementById("ub-exporter-list");

    overlay.classList.add("open");
    list.innerHTML = `<div id="ub-exporter-empty">Scanning storage...</div>`;

    try {
      const books = await findBooks();

      if (!books.length) {
        list.innerHTML = `<div id="ub-exporter-empty">No offline books found. Download the book for offline use in Unibok first.</div>`;
        return;
      }

      list.innerHTML = "";

      for (const book of books) {
        const row = document.createElement("div");
        row.className = "ub-exporter-row";
        row.innerHTML = `
          <div>
            <div class="ub-exporter-title"></div>
            <div class="ub-exporter-meta"></div>
          </div>
          <button class="ub-exporter-action ai">AI text</button>
          <button class="ub-exporter-action reader">Reader HTML</button>
        `;

        row.querySelector(".ub-exporter-title").textContent = book.title || book.id;
        row.querySelector(".ub-exporter-meta").textContent = `${book.id} · ${book.count} records`;
        row.querySelector(".ai").addEventListener("click", event => exportBook(book, event.currentTarget, MODES.AI));
        row.querySelector(".reader").addEventListener("click", event => exportBook(book, event.currentTarget, MODES.READER));

        list.appendChild(row);
      }
    } catch (error) {
      console.error("[Unibok exporter]", error);
      list.innerHTML = `<div id="ub-exporter-empty">Error while scanning storage. Check console.</div>`;
    }
  }

  // =======================================================
  // OFFLINE BOOK DISCOVERY
  // =======================================================

  async function findBooks() {
    if (!indexedDB.databases) {
      throw new Error("indexedDB.databases() is not available in this browser.");
    }

    const databases = await indexedDB.databases();
    const books = [];

    for (const info of databases) {
      if (!info.name || !info.name.startsWith("bookId_")) continue;

      try {
        const db = await openDb(info.name);

        if (!Array.from(db.objectStoreNames).includes("keyvaluepairs")) {
          db.close();
          continue;
        }

        const count = await countRecords(db, "keyvaluepairs");
        if (!count) {
          db.close();
          continue;
        }

        const title = await getBookTitle(db);
        db.close();

        books.push({
          id: info.name.replace("bookId_", ""),
          dbName: info.name,
          count,
          title
        });
      } catch (error) {
        console.warn("Could not inspect database:", info.name, error);
      }
    }

    return books.sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  }

  async function getBookTitle(db) {
    return new Promise(resolve => {
      const tx = db.transaction("keyvaluepairs", "readonly");
      const store = tx.objectStore("keyvaluepairs");
      const req = store.openCursor();

      req.onsuccess = async event => {
        const cursor = event.target.result;

        if (!cursor) {
          resolve(null);
          return;
        }

        const key = String(cursor.key);

        if (/\.opf$/i.test(key)) {
          try {
            const text = await decodeValue(cursor.value);
            const xml = new DOMParser().parseFromString(text, "application/xml");
            resolve(xml.querySelector("title")?.textContent?.trim() || null);
          } catch {
            resolve(null);
          }
          return;
        }

        cursor.continue();
      };

      req.onerror = () => resolve(null);
    });
  }

  // =======================================================
  // EXPORT
  // =======================================================

  async function exportBook(book, button, mode) {
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Opening...";

    try {
      const db = await openDb(book.dbName);
      button.textContent = "Reading...";
      const records = await getAllRecords(db, "keyvaluepairs");
      db.close();

      const structure = await getBookStructure(records, book.title || book.id);

      if (mode === MODES.AI) {
        button.textContent = "Building text...";
        await exportAiVersion(structure, records, button);
      } else {
        button.textContent = "Building HTML...";
        await exportReaderVersion(structure, records, button);
      }

      button.textContent = "Done";
    } catch (error) {
      console.error("[Unibok exporter]", error);
      button.textContent = "Error";
    }

    setTimeout(() => {
      button.textContent = oldText;
      button.disabled = false;
    }, 3000);
  }

  async function getBookStructure(records, fallbackTitle) {
    const keys = Object.keys(records);
    const opfKey = keys.find(key => /\.opf$/i.test(key) || /content\.opf$/i.test(key) || /package\.opf$/i.test(key));

    let title = fallbackTitle;
    let chapters = [];
    let cssFiles = [];

    if (opfKey) {
      const opfText = await decodeValue(records[opfKey]);
      const opf = new DOMParser().parseFromString(opfText, "application/xml");
      title = opf.querySelector("title")?.textContent?.trim() || title;

      const manifest = {};

      opf.querySelectorAll("manifest item").forEach(item => {
        const id = item.getAttribute("id");
        const href = item.getAttribute("href");
        const mediaType = item.getAttribute("media-type") || "";

        if (!id || !href) return;

        const fullPath = resolvePath(dirname(opfKey), href);
        manifest[id] = { href: fullPath, mediaType };

        if (/text\/css/i.test(mediaType)) cssFiles.push(fullPath);
      });

      opf.querySelectorAll("spine itemref").forEach(ref => {
        const item = manifest[ref.getAttribute("idref")];
        if (item?.href) chapters.push(item.href);
      });
    }

    if (!chapters.length) {
      chapters = keys.filter(key => /\.(xhtml|html|htm)$/i.test(key)).sort();
    }

    return { title, chapters, cssFiles: [...new Set(cssFiles)] };
  }

  async function exportAiVersion(structure, records, button) {
    const parser = new DOMParser();
    let htmlContent = "";
    let textContent = "";

    for (let i = 0; i < structure.chapters.length; i++) {
      button.textContent = `AI ${i + 1}/${structure.chapters.length}`;

      const chapterKey = findRecordKey(records, structure.chapters[i]);
      if (!chapterKey) continue;

      const chapterText = await decodeValue(records[chapterKey]);
      const doc = parser.parseFromString(chapterText, "text/html");
      cleanForAi(doc);

      const chapterTitle = doc.querySelector("h1,h2,h3,title")?.textContent?.trim() || `Chapter ${i + 1}`;
      const body = doc.body || doc.documentElement;

      htmlContent += `<section class="chapter"><h2>${escapeHtml(chapterTitle)}</h2>${makeSemanticHtml(body)}</section>`;
      textContent += `\n\n# ${chapterTitle}\n\n${makePlainText(body)}\n`;
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(structure.title)} - AI</title><style>${aiCss()}</style></head><body><main id="book"><h1>${escapeHtml(structure.title)}</h1>${htmlContent}</main></body></html>`;

    saveFile(`${safeFileName(structure.title)} - AI.html`, html, "text/html;charset=utf-8");
    saveFile(`${safeFileName(structure.title)} - AI.txt`, textContent.trim(), "text/plain;charset=utf-8");
  }

  async function exportReaderVersion(structure, records, button) {
    const parser = new DOMParser();
    const cssParts = [];
    let content = "";

    for (const cssPath of structure.cssFiles) {
      const key = findRecordKey(records, cssPath);
      if (!key) continue;
      const css = await decodeValue(records[key]);
      cssParts.push(await rewriteCssUrls(css, dirname(key), records));
    }

    for (let i = 0; i < structure.chapters.length; i++) {
      button.textContent = `Reader ${i + 1}/${structure.chapters.length}`;

      const chapterKey = findRecordKey(records, structure.chapters[i]);
      if (!chapterKey) continue;

      const chapterText = await decodeValue(records[chapterKey]);
      const doc = parser.parseFromString(chapterText, "text/html");
      await rewriteAssetsInDocument(doc, chapterKey, records, cssParts);
      doc.querySelectorAll("script").forEach(el => el.remove());

      content += `<section class="ub-chapter">${doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML}</section>`;
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(structure.title)} - Reader</title><style>${readerCss()}\n${cssParts.join("\n")}</style></head><body><main id="book"><h1>${escapeHtml(structure.title)}</h1>${content}</main></body></html>`;
    saveFile(`${safeFileName(structure.title)} - READER.html`, html, "text/html;charset=utf-8");
  }

  // =======================================================
  // HTML AND ASSET HELPERS
  // =======================================================

  function cleanForAi(doc) {
    doc.querySelectorAll("script, style, link, svg, canvas, iframe, object, embed, video, audio, nav, aside, footer, form, button, input, select, textarea, [role='navigation'], [aria-hidden='true']").forEach(el => el.remove());

    doc.querySelectorAll("img").forEach(img => {
      const note = doc.createElement("p");
      note.textContent = img.getAttribute("alt")?.trim() ? `[Image: ${img.getAttribute("alt").trim()}]` : "[Image removed]";
      img.replaceWith(note);
    });
  }

  function makeSemanticHtml(root) {
    const allowed = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "BLOCKQUOTE", "PRE", "CODE", "STRONG", "B", "EM", "I", "SUB", "SUP", "BR", "HR"]);
    const clone = root.cloneNode(true);

    function cleanNode(node) {
      for (const child of Array.from(node.children || [])) {
        cleanNode(child);
        if (!allowed.has(child.tagName)) {
          const parent = child.parentNode;
          while (child.firstChild) parent.insertBefore(child.firstChild, child);
          parent.removeChild(child);
        }
      }
    }

    cleanNode(clone);
    return clone.innerHTML.replace(/\u00a0/g, " ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function makePlainText(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,tr,blockquote,pre").forEach(el => {
      el.insertAdjacentText("beforebegin", "\n");
      el.insertAdjacentText("afterend", "\n");
    });
    clone.querySelectorAll("td,th").forEach(el => el.insertAdjacentText("afterend", " | "));
    return clone.textContent.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function rewriteAssetsInDocument(doc, chapterKey, records, cssParts) {
    const baseDir = dirname(chapterKey);

    for (const link of Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'))) {
      const cssKey = findRecordKey(records, resolvePath(baseDir, link.getAttribute("href")));
      if (cssKey) cssParts.push(await rewriteCssUrls(await decodeValue(records[cssKey]), dirname(cssKey), records));
      link.remove();
    }

    for (const style of Array.from(doc.querySelectorAll("style"))) {
      style.textContent = await rewriteCssUrls(style.textContent || "", baseDir, records);
    }

    for (const img of Array.from(doc.querySelectorAll("img[src]"))) {
      await rewriteUrlAttribute(img, "src", baseDir, records);
    }

    for (const element of Array.from(doc.querySelectorAll("image[href], image[xlink\\:href]"))) {
      if (element.hasAttribute("href")) await rewriteUrlAttribute(element, "href", baseDir, records);
      if (element.hasAttribute("xlink:href")) await rewriteUrlAttribute(element, "xlink:href", baseDir, records);
    }
  }

  async function rewriteUrlAttribute(element, attr, baseDir, records) {
    const original = element.getAttribute(attr);
    if (!original || isExternalUrl(original)) return;

    const dataUrl = await assetToDataUrl(original, baseDir, records);
    if (dataUrl) element.setAttribute(attr, dataUrl);
  }

  async function rewriteCssUrls(cssText, baseDir, records) {
    let output = cssText;
    const matches = [...cssText.matchAll(/url\((["']?)([^"'()]+)\1\)/gi)];

    for (const match of matches) {
      const full = match[0];
      const url = match[2].trim();
      if (!url || url.startsWith("#") || isExternalUrl(url)) continue;

      const dataUrl = await assetToDataUrl(url, baseDir, records);
      if (dataUrl) output = output.replace(full, `url("${dataUrl}")`);
    }

    return output;
  }

  async function assetToDataUrl(url, baseDir, records) {
    const wanted = resolvePath(baseDir, cleanUrl(url));
    const key = findRecordKey(records, wanted);
    if (!key) return null;
    return valueToDataUrl(records[key], mimeFromPath(key));
  }

  // =======================================================
  // INDEXEDDB AND GENERAL HELPERS
  // =======================================================

  function openDb(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = event => resolve(event.target.result);
      req.onerror = reject;
    });
  }

  function countRecords(db, storeName) {
    return new Promise(resolve => {
      try {
        const req = db.transaction(storeName, "readonly").objectStore(storeName).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }

  function getAllRecords(db, storeName) {
    return new Promise((resolve, reject) => {
      const all = {};
      const req = db.transaction(storeName, "readonly").objectStore(storeName).openCursor();

      req.onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) return resolve(all);
        all[String(cursor.key)] = cursor.value;
        cursor.continue();
      };

      req.onerror = reject;
    });
  }

  async function decodeValue(value) {
    if (typeof value === "string") return value;
    if (value instanceof Blob) return value.text();
    if (value instanceof ArrayBuffer) return new TextDecoder().decode(value);
    if (ArrayBuffer.isView(value)) return new TextDecoder().decode(value);
    if (value?.buffer instanceof ArrayBuffer) return new TextDecoder().decode(value.buffer);
    return String(value);
  }

  function valueToDataUrl(value, mime) {
    const blob = value instanceof Blob ? value : value instanceof ArrayBuffer ? new Blob([value], { type: mime }) : ArrayBuffer.isView(value) ? new Blob([value.buffer], { type: mime }) : typeof value === "string" ? new Blob([value], { type: mime }) : new Blob([String(value)], { type: mime });
    const finalBlob = blob.type ? blob : blob.slice(0, blob.size, mime);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(finalBlob);
    });
  }

  function saveFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function findRecordKey(records, wantedPath) {
    const wanted = normalizePath(cleanUrl(wantedPath)).toLowerCase();
    const keys = Object.keys(records);
    return keys.find(key => normalizePath(key).toLowerCase() === wanted) || keys.find(key => normalizePath(key).toLowerCase().endsWith("/" + wanted)) || keys.find(key => normalizePath(key).toLowerCase().endsWith(wanted));
  }

  function cleanUrl(url) {
    try {
      return decodeURIComponent(String(url).split("#")[0].split("?")[0]);
    } catch {
      return String(url).split("#")[0].split("?")[0];
    }
  }

  function isExternalUrl(url) {
    return /^(https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(String(url).trim());
  }

  function dirname(path) {
    const clean = normalizePath(path);
    const index = clean.lastIndexOf("/");
    return index === -1 ? "" : clean.slice(0, index);
  }

  function resolvePath(baseDir, relativePath) {
    const rel = cleanUrl(relativePath);
    if (!rel) return "";
    if (rel.startsWith("/")) return normalizePath(rel.replace(/^\/+/, ""));
    return normalizePath(`${baseDir}/${rel}`);
  }

  function normalizePath(path) {
    const output = [];
    for (const part of String(path).replace(/\\/g, "/").split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") output.pop();
      else output.push(part);
    }
    return output.join("/");
  }

  function mimeFromPath(path) {
    const ext = path.split(".").pop().toLowerCase();
    const map = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      svg: "image/svg+xml",
      webp: "image/webp",
      css: "text/css",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      otf: "font/otf",
      html: "text/html",
      htm: "text/html",
      xhtml: "application/xhtml+xml"
    };
    return map[ext] || "application/octet-stream";
  }

  function safeFileName(name) {
    return String(name).replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "unibok";
  }

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function readerCss() {
    return `html{background:#f5f5f5}body{margin:0;padding:24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55;color:#111}#book{max-width:980px;margin:0 auto;background:white;padding:32px;box-shadow:0 2px 18px rgba(0,0,0,.08)}img,svg,video,audio,canvas{max-width:100%;height:auto}.ub-chapter{margin-top:32px;padding-top:24px;border-top:1px solid #ddd}@media print{html{background:white}body{padding:0}#book{box-shadow:none;max-width:none;padding:0}}`;
  }

  function aiCss() {
    return `body{margin:0;padding:32px;background:#fafafa;color:#111;font-family:Arial,sans-serif;line-height:1.65}#book{max-width:900px;margin:0 auto;background:white;padding:32px;border:1px solid #ddd}h1,h2,h3,h4{line-height:1.25;margin-top:1.6em}p,li{font-size:16px}.chapter{border-top:2px solid #ddd;margin-top:32px;padding-top:24px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ccc;padding:8px;vertical-align:top}blockquote{border-left:4px solid #ccc;margin-left:0;padding-left:16px;color:#333}pre,code{white-space:pre-wrap;background:#f4f4f4;padding:2px 4px}`;
  }
})();
