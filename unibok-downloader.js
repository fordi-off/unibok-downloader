// unibok-downloader.js
// Version: Reader export + AI export

(function () {
  "use strict";

  const MODES = {
    AI: "ai",
    READER: "reader",
  };

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────

  const style = document.createElement("style");
  style.textContent = `
    #ub-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #2e7d32;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 15px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,.3);
      font-family: sans-serif;
    }

    #ub-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999998;
      background: rgba(0,0,0,.55);
      align-items: center;
      justify-content: center;
    }

    #ub-overlay.open {
      display: flex;
    }

    #ub-modal {
      background: white;
      border-radius: 12px;
      padding: 28px;
      width: 92%;
      max-width: 720px;
      max-height: 84vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,.3);
    }

    #ub-modal h2 {
      margin: 0 0 6px;
      color: #2e7d32;
      font-size: 19px;
    }

    #ub-modal p {
      margin: 0 0 16px;
      color: #666;
      font-size: 13px;
      line-height: 1.4;
    }

    #ub-list {
      overflow-y: auto;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .ub-book {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8px;
      align-items: center;
      padding: 12px 14px;
      border-bottom: 1px solid #eee;
    }

    .ub-book:last-child {
      border-bottom: none;
    }

    .ub-book:hover {
      background: #f1f8e9;
    }

    .ub-title {
      font-weight: bold;
      font-size: 14px;
      color: #222;
    }

    .ub-meta {
      font-size: 12px;
      color: #888;
      margin-top: 2px;
    }

    .ub-dl {
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      color: white;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
    }

    .ub-dl.ai {
      background: #1565c0;
    }

    .ub-dl.reader {
      background: #2e7d32;
    }

    .ub-dl:disabled {
      background: #aaa !important;
      cursor: default;
    }

    #ub-close {
      align-self: flex-end;
      background: #eee;
      border: none;
      border-radius: 6px;
      padding: 9px 18px;
      cursor: pointer;
    }

    #ub-empty {
      padding: 20px;
      color: #666;
      text-align: center;
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "ub-overlay";
  overlay.innerHTML = `
    <div id="ub-modal">
      <h2>Available books</h2>
      <p>
        <b>AI version</b> = ren tekst/HTML for ChatGPT.
        <br>
        <b>Reader version</b> = prøver å beholde bilder og styling.
      </p>
      <div id="ub-list">
        <div id="ub-empty">Scanning storage...</div>
      </div>
      <button id="ub-close">Close</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const mainButton = document.createElement("button");
  mainButton.id = "ub-btn";
  mainButton.textContent = "Download Book";
  document.body.appendChild(mainButton);

  mainButton.onclick = openModal;
  document.getElementById("ub-close").onclick = () => overlay.classList.remove("open");

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.classList.remove("open");
  };

  async function openModal() {
    overlay.classList.add("open");

    const list = document.getElementById("ub-list");
    list.innerHTML = `<div id="ub-empty">Scanning storage...</div>`;

    const books = await findBooks();

    if (!books.length) {
      list.innerHTML = `<div id="ub-empty">No offline books found. Download the book for offline use in Unibok first.</div>`;
      return;
    }

    list.innerHTML = "";

    for (const book of books) {
      const row = document.createElement("div");
      row.className = "ub-book";

      row.innerHTML = `
        <div>
          <div class="ub-title"></div>
          <div class="ub-meta"></div>
        </div>
        <button class="ub-dl ai">AI version</button>
        <button class="ub-dl reader">Reader version</button>
      `;

      row.querySelector(".ub-title").textContent = book.title || book.id;
      row.querySelector(".ub-meta").textContent = `${book.id} · ${book.count} files`;

      row.querySelector(".ai").onclick = (e) => {
        e.stopPropagation();
        downloadBook(book, e.target, MODES.AI);
      };

      row.querySelector(".reader").onclick = (e) => {
        e.stopPropagation();
        downloadBook(book, e.target, MODES.READER);
      };

      list.appendChild(row);
    }
  }

  // ─────────────────────────────────────────────
  // Find books in IndexedDB
  // ─────────────────────────────────────────────

  async function findBooks() {
    const databases = await indexedDB.databases();
    const books = [];

    for (const dbInfo of databases) {
      if (!dbInfo.name || !dbInfo.name.startsWith("bookId_")) continue;

      try {
        const db = await openDb(dbInfo.name);

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
          id: dbInfo.name.replace("bookId_", ""),
          dbName: dbInfo.name,
          count,
          title,
        });
      } catch (err) {
        console.warn("[Unibok downloader] Could not read DB:", dbInfo.name, err);
      }
    }

    return books.sort((a, b) => {
      return (a.title || a.id).localeCompare(b.title || b.id);
    });
  }

  async function getBookTitle(db) {
    return new Promise((resolve) => {
      const tx = db.transaction("keyvaluepairs", "readonly");
      const store = tx.objectStore("keyvaluepairs");
      const req = store.openCursor();

      req.onsuccess = async (e) => {
        const cursor = e.target.result;

        if (!cursor) {
          resolve(null);
          return;
        }

        const key = String(cursor.key);

        if (key.endsWith(".opf")) {
          try {
            const text = await decodeValue(cursor.value);
            const xml = new DOMParser().parseFromString(text, "application/xml");
            resolve(xml.querySelector("title")?.textContent || null);
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

  // ─────────────────────────────────────────────
  // Main export
  // ─────────────────────────────────────────────

  async function downloadBook(book, button, mode) {
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Opening...";

    try {
      const db = await openDb(book.dbName);

      button.textContent = "Reading files...";
      const records = await getAllRecords(db, "keyvaluepairs");
      db.close();

      const bookData = await getBookStructure(records, book.title || book.id);

      if (mode === MODES.AI) {
        await exportAi(bookData, records, button);
      } else {
        await exportReader(bookData, records, button);
      }

      button.textContent = "Done!";
      setTimeout(() => {
        button.textContent = oldText;
        button.disabled = false;
      }, 3000);
    } catch (err) {
      console.error("[Unibok downloader]", err);
      button.textContent = "Error";
      setTimeout(() => {
        button.textContent = oldText;
        button.disabled = false;
      }, 3000);
    }
  }

  async function getBookStructure(records, fallbackTitle) {
    const keys = Object.keys(records);

    const opfKey = keys.find((k) => {
      return /\.opf$/i.test(k) || /content\.opf$/i.test(k) || /package\.opf$/i.test(k);
    });

    let title = fallbackTitle;
    let chapters = [];
    let cssFiles = [];

    if (opfKey) {
      const opfText = await decodeValue(records[opfKey]);
      const opf = new DOMParser().parseFromString(opfText, "application/xml");

      title = opf.querySelector("title")?.textContent?.trim() || title;

      const manifest = {};

      opf.querySelectorAll("manifest item").forEach((item) => {
        const id = item.getAttribute("id");
        const href = item.getAttribute("href");
        const mediaType = item.getAttribute("media-type") || "";

        if (!id || !href) return;

        const fullPath = resolvePath(dirname(opfKey), href);

        manifest[id] = {
          href: fullPath,
          mediaType,
        };

        if (/text\/css/i.test(mediaType)) {
          cssFiles.push(fullPath);
        }
      });

      opf.querySelectorAll("spine itemref").forEach((ref) => {
        const idref = ref.getAttribute("idref");
        const item = manifest[idref];

        if (item && item.href) {
          chapters.push(item.href);
        }
      });
    }

    if (!chapters.length) {
      chapters = keys.filter((k) => /\.(xhtml|html|htm)$/i.test(k)).sort();
    }

    cssFiles = [...new Set(cssFiles)];

    return {
      title,
      chapters,
      cssFiles,
    };
  }

  // ─────────────────────────────────────────────
  // Reader version
  // ─────────────────────────────────────────────

  async function exportReader(bookData, records, button) {
    const parser = new DOMParser();
    const cssParts = [];

    button.textContent = "Building CSS...";

    for (const cssPath of bookData.cssFiles) {
      const key = findRecordKey(records, cssPath);
      if (!key) continue;

      const css = await decodeValue(records[key]);
      const rewritten = await rewriteCssUrls(css, dirname(key), records);
      cssParts.push(rewritten);
    }

    let content = "";

    for (let i = 0; i < bookData.chapters.length; i++) {
      button.textContent = `Reader ${i + 1}/${bookData.chapters.length}`;

      const chapterKey = findRecordKey(records, bookData.chapters[i]);
      if (!chapterKey) continue;

      const chapterText = await decodeValue(records[chapterKey]);
      const doc = parser.parseFromString(chapterText, "text/html");

      await rewriteAssetsInDocument(doc, chapterKey, records, cssParts);

      doc.querySelectorAll("script").forEach((el) => el.remove());

      content += `
<section class="ub-chapter" data-source="${escapeHtml(chapterKey)}">
${doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML}
</section>`;
    }

    const html = `<!doctype html>
<html lang="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(bookData.title)} - Reader</title>
  <style>
    ${readerCss()}
    ${cssParts.join("\n\n")}
  </style>
</head>
<body>
  <main id="book">
    <h1>${escapeHtml(bookData.title)}</h1>
    ${content}
  </main>
</body>
</html>`;

    saveFile(`${safeFileName(bookData.title)} - READER.html`, html, "text/html;charset=utf-8");
  }

  async function rewriteAssetsInDocument(doc, chapterKey, records, cssParts) {
    const baseDir = dirname(chapterKey);

    const links = Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'));

    for (const link of links) {
      const href = link.getAttribute("href");
      const cssKey = findRecordKey(records, resolvePath(baseDir, href));

      if (cssKey) {
        const css = await decodeValue(records[cssKey]);
        cssParts.push(await rewriteCssUrls(css, dirname(cssKey), records));
      }

      link.remove();
    }

    for (const style of Array.from(doc.querySelectorAll("style"))) {
      style.textContent = await rewriteCssUrls(style.textContent || "", baseDir, records);
    }

    for (const img of Array.from(doc.querySelectorAll("img[src]"))) {
      await rewriteUrlAttribute(img, "src", baseDir, records);
    }

    for (const el of Array.from(doc.querySelectorAll("img[srcset], source[srcset]"))) {
      const srcset = el.getAttribute("srcset");
      if (srcset) {
        el.setAttribute("srcset", await rewriteSrcset(srcset, baseDir, records));
      }
    }

    for (const el of Array.from(doc.querySelectorAll("image[href], image[xlink\\:href]"))) {
      if (el.hasAttribute("href")) {
        await rewriteUrlAttribute(el, "href", baseDir, records);
      }

      if (el.hasAttribute("xlink:href")) {
        await rewriteUrlAttribute(el, "xlink:href", baseDir, records);
      }
    }

    for (const video of Array.from(doc.querySelectorAll("video[poster]"))) {
      await rewriteUrlAttribute(video, "poster", baseDir, records);
    }

    for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href");

      if (!href || href.startsWith("#") || isExternalUrl(href)) continue;

      const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "#";
      a.setAttribute("href", hash);
    }
  }

  async function rewriteUrlAttribute(el, attr, baseDir, records) {
    const original = el.getAttribute(attr);

    if (!original || isExternalUrl(original)) return;

    const dataUrl = await assetToDataUrl(original, baseDir, records);

    if (dataUrl) {
      el.setAttribute(attr, dataUrl);
    }
  }

  async function rewriteSrcset(srcset, baseDir, records) {
    const parts = srcset.split(",").map((x) => x.trim()).filter(Boolean);
    const result = [];

    for (const part of parts) {
      const split = part.split(/\s+/);
      const url = split[0];
      const descriptor = split.slice(1).join(" ");

      if (isExternalUrl(url)) {
        result.push(part);
        continue;
      }

      const dataUrl = await assetToDataUrl(url, baseDir, records);
      result.push(`${dataUrl || url}${descriptor ? " " + descriptor : ""}`);
    }

    return result.join(", ");
  }

  async function rewriteCssUrls(cssText, baseDir, records) {
    let output = cssText;

    const urlRegex = /url\((['"]?)([^'"()]+)\1\)/gi;
    const matches = [...cssText.matchAll(urlRegex)];

    for (const match of matches) {
      const full = match[0];
      const url = match[2].trim();

      if (!url || url.startsWith("#") || isExternalUrl(url)) continue;

      const dataUrl = await assetToDataUrl(url, baseDir, records);

      if (dataUrl) {
        output = output.replace(full, `url("${dataUrl}")`);
      }
    }

    const importRegex = /@import\s+(?:url\()?['"]?([^'"\);]+)['"]?\)?\s*;/gi;
    const imports = [...output.matchAll(importRegex)];

    for (const match of imports) {
      const full = match[0];
      const href = match[1].trim();

      if (isExternalUrl(href)) continue;

      const cssKey = findRecordKey(records, resolvePath(baseDir, href));
      if (!cssKey) continue;

      const importedCss = await decodeValue(records[cssKey]);
      const fixedCss = await rewriteCssUrls(importedCss, dirname(cssKey), records);

      output = output.replace(full, fixedCss);
    }

    return output;
  }

  async function assetToDataUrl(url, baseDir, records) {
    const cleaned = cleanUrl(url);
    const wanted = resolvePath(baseDir, cleaned);
    const key = findRecordKey(records, wanted);

    if (!key) return null;

    return valueToDataUrl(records[key], mimeFromPath(key));
  }

  // ─────────────────────────────────────────────
  // AI version
  // ─────────────────────────────────────────────

  async function exportAi(bookData, records, button) {
    const parser = new DOMParser();

    let htmlContent = "";
    let textContent = "";

    for (let i = 0; i < bookData.chapters.length; i++) {
      button.textContent = `AI ${i + 1}/${bookData.chapters.length}`;

      const chapterKey = findRecordKey(records, bookData.chapters[i]);
      if (!chapterKey) continue;

      const chapterText = await decodeValue(records[chapterKey]);
      const doc = parser.parseFromString(chapterText, "text/html");

      cleanForAi(doc);

      const chapterTitle =
        doc.querySelector("h1,h2,h3,title")?.textContent?.trim() ||
        `Kapittel ${i + 1}`;

      const body = doc.body || doc.documentElement;

      htmlContent += `
<section class="chapter" data-source="${escapeHtml(chapterKey)}">
  <h2>${escapeHtml(chapterTitle)}</h2>
  ${makeSemanticHtml(body)}
</section>`;

      textContent += `\n\n# ${chapterTitle}\n\n${makePlainText(body)}\n`;
    }

    const html = `<!doctype html>
<html lang="no">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(bookData.title)} - AI</title>
  <style>
    ${aiCss()}
  </style>
</head>
<body>
  <article id="book">
    <header>
      <h1>${escapeHtml(bookData.title)}</h1>
      <p class="meta">
        Dette er en ren AI-versjon. Bilder, scripts, menyer og tung styling er fjernet.
        Overskrifter, tekst, lister og tabeller er beholdt.
      </p>
    </header>
    ${htmlContent}
  </article>
</body>
</html>`;

    saveFile(`${safeFileName(bookData.title)} - AI.html`, html, "text/html;charset=utf-8");
    saveFile(`${safeFileName(bookData.title)} - AI.txt`, textContent.trim(), "text/plain;charset=utf-8");
  }

  function cleanForAi(doc) {
    doc.querySelectorAll(`
      script, style, link, svg, canvas, iframe, object, embed,
      video, audio, nav, aside, footer, form, button, input,
      select, textarea, [role="navigation"], [aria-hidden="true"]
    `).forEach((el) => el.remove());

    doc.querySelectorAll("img").forEach((img) => {
      const alt = img.getAttribute("alt")?.trim();
      const p = doc.createElement("p");
      p.className = "image-note";
      p.textContent = alt ? `[Bilde: ${alt}]` : "[Bilde fjernet]";
      img.replaceWith(p);
    });

    doc.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();

        if (name !== "rowspan" && name !== "colspan") {
          el.removeAttribute(attr.name);
        }
      }
    });

    doc.querySelectorAll("*").forEach((el) => {
      const keepEmpty = ["BR", "HR", "TD", "TH"].includes(el.tagName);

      if (!keepEmpty && !el.textContent.trim()) {
        el.remove();
      }
    });
  }

  function makeSemanticHtml(root) {
    const allowed = new Set([
      "H1", "H2", "H3", "H4", "H5", "H6",
      "P", "UL", "OL", "LI",
      "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
      "BLOCKQUOTE", "PRE", "CODE",
      "STRONG", "B", "EM", "I", "SUB", "SUP",
      "BR", "HR",
    ]);

    const clone = root.cloneNode(true);

    function cleanNode(node) {
      for (const child of Array.from(node.children || [])) {
        cleanNode(child);

        if (!allowed.has(child.tagName)) {
          const parent = child.parentNode;

          while (child.firstChild) {
            parent.insertBefore(child.firstChild, child);
          }

          parent.removeChild(child);
        }
      }
    }

    cleanNode(clone);

    return clone.innerHTML
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function makePlainText(root) {
    const clone = root.cloneNode(true);

    clone.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,tr,blockquote,pre").forEach((el) => {
      el.insertAdjacentText("beforebegin", "\n");
      el.insertAdjacentText("afterend", "\n");
    });

    clone.querySelectorAll("td,th").forEach((el) => {
      el.insertAdjacentText("afterend", " | ");
    });

    return clone.textContent
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // ─────────────────────────────────────────────
  // IndexedDB helpers
  // ─────────────────────────────────────────────

  function openDb(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name);

      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = reject;
    });
  }

  function countRecords(db, storeName) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).count();

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
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.openCursor();

      req.onsuccess = (e) => {
        const cursor = e.target.result;

        if (!cursor) {
          resolve(all);
          return;
        }

        all[String(cursor.key)] = cursor.value;
        cursor.continue();
      };

      req.onerror = reject;
    });
  }

  // ─────────────────────────────────────────────
  // General helpers
  // ─────────────────────────────────────────────

  async function decodeValue(value) {
    if (typeof value === "string") return value;

    if (value instanceof Blob) {
      return value.text();
    }

    if (value instanceof ArrayBuffer) {
      return new TextDecoder().decode(value);
    }

    if (ArrayBuffer.isView(value)) {
      return new TextDecoder().decode(value);
    }

    if (value?.buffer instanceof ArrayBuffer) {
      return new TextDecoder().decode(value.buffer);
    }

    return String(value);
  }

  function valueToDataUrl(value, mime) {
    const blob =
      value instanceof Blob
        ? value
        : value instanceof ArrayBuffer
          ? new Blob([value], { type: mime })
          : ArrayBuffer.isView(value)
            ? new Blob([value.buffer], { type: mime })
            : typeof value === "string"
              ? new Blob([value], { type: mime })
              : new Blob([String(value)], { type: mime });

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
    const a = document.createElement("a");

    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();

    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function findRecordKey(records, wantedPath) {
    const keys = Object.keys(records);
    const wanted = normalizePath(cleanUrl(wantedPath)).toLowerCase();

    return (
      keys.find((k) => normalizePath(k).toLowerCase() === wanted) ||
      keys.find((k) => normalizePath(k).toLowerCase().endsWith("/" + wanted)) ||
      keys.find((k) => normalizePath(k).toLowerCase().endsWith(wanted))
    );
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

    if (index === -1) return "";

    return clean.slice(0, index);
  }

  function resolvePath(baseDir, relativePath) {
    const rel = cleanUrl(relativePath);

    if (!rel) return "";

    if (rel.startsWith("/")) {
      return normalizePath(rel.replace(/^\/+/, ""));
    }

    return normalizePath(`${baseDir}/${rel}`);
  }

  function normalizePath(path) {
    const parts = String(path).replace(/\\/g, "/").split("/");
    const output = [];

    for (const part of parts) {
      if (!part || part === ".") continue;

      if (part === "..") {
        output.pop();
      } else {
        output.push(part);
      }
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
      avif: "image/avif",
      css: "text/css",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      otf: "font/otf",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      m4a: "audio/mp4",
      html: "text/html",
      htm: "text/html",
      xhtml: "application/xhtml+xml",
    };

    return map[ext] || "application/octet-stream";
  }

  function safeFileName(name) {
    return String(name)
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "unibok";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readerCss() {
    return `
      html {
        background: #f5f5f5;
      }

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
        html {
          background: white;
        }

        body {
          padding: 0;
        }

        #book {
          box-shadow: none;
          max-width: none;
          padding: 0;
        }
      }
    `;
  }

  function aiCss() {
    return `
      body {
        margin: 0;
        padding: 32px;
        background: #fafafa;
        color: #111;
        font-family: Arial, sans-serif;
        line-height: 1.65;
      }

      #book {
        max-width: 900px;
        margin: 0 auto;
        background: white;
        padding: 32px;
        border: 1px solid #ddd;
      }

      h1, h2, h3, h4 {
        line-height: 1.25;
        margin-top: 1.6em;
      }

      p, li {
        font-size: 16px;
      }

      .meta,
      .image-note {
        color: #666;
        font-size: 14px;
      }

      .chapter {
        border-top: 2px solid #ddd;
        margin-top: 32px;
        padding-top: 24px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
      }

      th,
      td {
        border: 1px solid #ccc;
        padding: 8px;
        vertical-align: top;
      }

      blockquote {
        border-left: 4px solid #ccc;
        margin-left: 0;
        padding-left: 16px;
        color: #333;
      }

      pre,
      code {
        white-space: pre-wrap;
        background: #f4f4f4;
        padding: 2px 4px;
      }
    `;
  }
})();