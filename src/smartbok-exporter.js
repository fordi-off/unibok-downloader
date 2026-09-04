(function () {
  "use strict";

  // =======================================================
  // SETUP VARIABLES
  // =======================================================

  const SETUP = {
    buttonText: "Download Smartbok chapters",
    modalTitle: "Select chapters to download",
    fileType: "md", // "md" or "txt"
    buttonRight: "24px",
    buttonBottom: "24px",
    buttonZIndex: "999999",
    loadedFlag: "__smartbokExporterLoaded"
  };

  // =======================================================
  // INIT
  // =======================================================

  if (window[SETUP.loadedFlag]) {
    console.log("Smartbok exporter is already loaded.");
    return;
  }

  window[SETUP.loadedFlag] = true;
  waitForBody(createButton);

  function waitForBody(callback) {
    if (document.body) callback();
    else setTimeout(() => waitForBody(callback), 300);
  }

  function createButton() {
    if (document.getElementById("smartbok-exporter-button")) return;

    const button = document.createElement("button");
    button.id = "smartbok-exporter-button";
    button.textContent = SETUP.buttonText;

    Object.assign(button.style, {
      position: "fixed",
      right: SETUP.buttonRight,
      bottom: SETUP.buttonBottom,
      zIndex: SETUP.buttonZIndex,
      padding: "12px 16px",
      borderRadius: "12px",
      border: "none",
      background: "#111",
      color: "#fff",
      fontSize: "14px",
      fontFamily: "Arial, sans-serif",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)"
    });

    button.addEventListener("mouseenter", () => (button.style.background = "#333"));
    button.addEventListener("mouseleave", () => (button.style.background = "#111"));
    button.addEventListener("click", openChapterPicker);

    document.body.appendChild(button);
    console.log("Smartbok exporter button created.");
  }

  // =======================================================
  // CHAPTER PICKER
  // =======================================================

  async function openChapterPicker() {
    ensureChapterModal();
    showChapterModalStatus("Scanning book for chapters...");

    try {
      const cloudBookPath = sessionStorage.getItem("cloudBookPATH");
      if (!cloudBookPath) {
        throw new Error("Could not find cloudBookPATH. Open a Smartbok book first.");
      }

      const bookTitle = sessionStorage.getItem("bookTitle") || document.title || "Smartbok excerpt";
      const BOOK_BASE = cloudBookPath.replace(/\/$/, "");
      const JSON_BASE = BOOK_BASE + "/OPS/json";

      const LAST_PAGE = await findLastPageNumber(BOOK_BASE, JSON_BASE, 5000);
      const pageJsonFiles = await getAvailablePageJsonFiles(1, LAST_PAGE, LAST_PAGE);
      const tocRows = getTocFromDom();
      const jsonCache = {};

      const chapters = await scanChapterBoundaries({ JSON_BASE, pageJsonFiles, tocRows, jsonCache, LAST_PAGE });

      if (!chapters.length) {
        chapters.push({ title: bookTitle, type: "chapter", startPage: 1, endPage: LAST_PAGE });
      }

      renderChapterList(chapters, { JSON_BASE, pageJsonFiles, tocRows, jsonCache, bookTitle, LAST_PAGE });
    } catch (error) {
      console.error("[Smartbok exporter]", error);
      showChapterModalStatus("Error: " + error.message);
    }
  }

  // Pre-scans every page once to find where each chapter/subchapter begins,
  // reusing the same JSON cache the export step will use afterwards.
  async function scanChapterBoundaries({ JSON_BASE, pageJsonFiles, tocRows, jsonCache, LAST_PAGE }) {
    const detections = [];

    for (let pageNum = 1; pageNum <= LAST_PAGE; pageNum++) {
      showChapterModalStatus(`Scanning book for chapters... (page ${pageNum}/${LAST_PAGE})`);

      const filename = getJsonFileForPage(pageJsonFiles, pageNum, LAST_PAGE);
      let data;

      try {
        data = await getJsonData(JSON_BASE, filename, jsonCache);
      } catch {
        continue;
      }

      const page = findPage(data, pageNum);
      if (!page) continue;

      const lines = extractLinesFromPage(page).map(cleanLine).filter(Boolean);
      if (!lines.length) continue;

      const title = findCertainTocTitleInLines(lines, tocRows);
      if (!title || title.type === "content") continue;

      const last = detections[detections.length - 1];
      if (!last || last.title !== title.text) {
        detections.push({ title: title.text, type: title.type, startPage: pageNum });
      }
    }

    return detections.map((entry, i) => ({
      title: entry.title,
      type: entry.type,
      startPage: entry.startPage,
      endPage: i + 1 < detections.length ? detections[i + 1].startPage - 1 : LAST_PAGE
    }));
  }

  function ensureChapterModal() {
    injectChapterModalStyles();

    if (document.getElementById("sb-exporter-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "sb-exporter-overlay";
    overlay.innerHTML = `
      <div id="sb-exporter-modal">
        <h2>${escapeHtml(SETUP.modalTitle)}</h2>
        <p>Choose which chapters to include. Use this only for material you are allowed to access and export.</p>
        <div id="sb-exporter-controls">
          <button id="sb-exporter-select-all" type="button">Select all</button>
          <button id="sb-exporter-select-none" type="button">Select none</button>
        </div>
        <div id="sb-exporter-list"><div class="sb-exporter-status">Scanning book for chapters...</div></div>
        <div id="sb-exporter-actions">
          <button id="sb-exporter-cancel" type="button">Cancel</button>
          <button id="sb-exporter-download" type="button" disabled>Download selected</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeChapterModal();
    });

    document.body.appendChild(overlay);
    document.getElementById("sb-exporter-cancel").addEventListener("click", closeChapterModal);
    overlay.classList.add("open");
  }

  function closeChapterModal() {
    const overlay = document.getElementById("sb-exporter-overlay");
    if (overlay) overlay.classList.remove("open");
  }

  function showChapterModalStatus(message) {
    const list = document.getElementById("sb-exporter-list");
    if (list) list.innerHTML = `<div class="sb-exporter-status">${escapeHtml(message)}</div>`;
  }

  function renderChapterList(chapters, ctx) {
    const list = document.getElementById("sb-exporter-list");
    const downloadButton = document.getElementById("sb-exporter-download");
    if (!list || !downloadButton) return;

    list.innerHTML = "";

    chapters.forEach((chapter, index) => {
      const row = document.createElement("label");
      row.className = `sb-exporter-row sb-exporter-row-${chapter.type}`;
      row.innerHTML = `
        <input type="checkbox" checked data-index="${index}">
        <span class="sb-exporter-row-title">${escapeHtml(chapter.title)}</span>
        <span class="sb-exporter-row-meta">p. ${chapter.startPage}–${chapter.endPage}</span>
      `;
      list.appendChild(row);
    });

    const checkboxes = () => Array.from(list.querySelectorAll('input[type="checkbox"]'));
    downloadButton.disabled = false;

    document.getElementById("sb-exporter-select-all").onclick = () => checkboxes().forEach(box => (box.checked = true));
    document.getElementById("sb-exporter-select-none").onclick = () => checkboxes().forEach(box => (box.checked = false));

    downloadButton.onclick = async () => {
      const selected = checkboxes().filter(box => box.checked).map(box => chapters[Number(box.dataset.index)]);

      if (!selected.length) {
        alert("Select at least one chapter.");
        return;
      }

      downloadButton.disabled = true;
      downloadButton.textContent = "Downloading...";

      try {
        await exportSelectedChapters(selected, ctx);
        closeChapterModal();
      } catch (error) {
        console.error("[Smartbok exporter]", error);
        alert("Error: " + error.message);
      } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = "Download selected";
      }
    };
  }

  function injectChapterModalStyles() {
    if (document.getElementById("sb-exporter-styles")) return;

    const style = document.createElement("style");
    style.id = "sb-exporter-styles";
    style.textContent = `
      #sb-exporter-overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 9999998;
        background: rgba(0,0,0,.55);
        align-items: center;
        justify-content: center;
      }
      #sb-exporter-overlay.open { display: flex; }
      #sb-exporter-modal {
        width: min(640px, 94vw);
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
      #sb-exporter-modal h2 { margin: 0 0 6px; font-size: 20px; color: #111; }
      #sb-exporter-modal p { margin: 0 0 14px; color: #555; font-size: 13px; line-height: 1.45; }
      #sb-exporter-controls { display: flex; gap: 8px; margin-bottom: 10px; }
      #sb-exporter-controls button { border: 1px solid #ccc; background: #f5f5f5; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
      #sb-exporter-controls button:hover { background: #eee; }
      #sb-exporter-list { overflow: auto; border: 1px solid #ddd; border-radius: 10px; margin-bottom: 16px; flex: 1; }
      .sb-exporter-status { padding: 20px; text-align: center; color: #666; }
      .sb-exporter-row { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 10px 14px; border-bottom: 1px solid #eee; cursor: pointer; }
      .sb-exporter-row:last-child { border-bottom: none; }
      .sb-exporter-row:hover { background: #f5f5f5; }
      .sb-exporter-row-subchapter .sb-exporter-row-title { padding-left: 16px; color: #444; }
      .sb-exporter-row-title { font-weight: 700; color: #222; }
      .sb-exporter-row-meta { font-size: 12px; color: #777; white-space: nowrap; }
      #sb-exporter-actions { display: flex; justify-content: flex-end; gap: 10px; }
      #sb-exporter-actions button { border: none; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-weight: 700; }
      #sb-exporter-cancel { background: #eee; }
      #sb-exporter-download { background: #111; color: #fff; }
      #sb-exporter-download:disabled { background: #aaa; cursor: default; }
    `;

    document.head.appendChild(style);
  }

  // =======================================================
  // MAIN EXPORT
  // =======================================================

  async function exportSelectedChapters(selectedChapters, ctx) {
    const { JSON_BASE, pageJsonFiles, tocRows, jsonCache, bookTitle, LAST_PAGE } = ctx;
    const sections = [];

    for (const chapter of selectedChapters) {
      let currentSection = { title: chapter.title, type: chapter.type, lines: [] };
      let sawOwnHeading = false;

      const pushCurrentSection = () => {
        if (currentSection.lines.some(line => cleanLine(line))) sections.push(currentSection);
      };

      for (let pageNum = chapter.startPage; pageNum <= chapter.endPage; pageNum++) {
        const filename = getJsonFileForPage(pageJsonFiles, pageNum, LAST_PAGE);
        let data;

        try {
          data = await getJsonData(JSON_BASE, filename, jsonCache);
        } catch {
          continue;
        }

        const page = findPage(data, pageNum);
        if (!page) continue;

        let lines = extractLinesFromPage(page).map(cleanLine).filter(Boolean);
        if (!lines.length) continue;

        const title = findCertainTocTitleInLines(lines, tocRows);

        if (title) {
          if (!sawOwnHeading && title.text === chapter.title) {
            sawOwnHeading = true;
          } else {
            pushCurrentSection();
            currentSection = { title: title.text, type: title.type, lines: [] };
          }
          lines = removeCertainHeadingLine(lines, title.text);
        }

        currentSection.lines.push(...lines);
      }

      pushCurrentSection();
    }

    let output = "";
    output += `# ${escapeMarkdownHeading(bookTitle)}\n\n`;
    output += `Selected chapters: ${selectedChapters.map(chapter => chapter.title).join(", ")}\n\n`;
    output += sections.map(formatSection).join("\n\n---\n\n");

    console.log(output);

    try {
      await navigator.clipboard.writeText(output);
      console.log("Excerpt copied to clipboard.");
    } catch (error) {
      console.warn("Could not copy to clipboard:", error);
    }

    const safeBookTitle = bookTitle.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 60);
    const rangeLabel = selectedChapters.length === 1
      ? `p${selectedChapters[0].startPage}-${selectedChapters[0].endPage}`
      : `${selectedChapters.length}_chapters`;
    const filename = `${safeBookTitle}_${rangeLabel}.${SETUP.fileType}`;
    const mimeType = SETUP.fileType === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";

    downloadTextFile(output, filename, mimeType);
    alert(`Done. Downloaded: ${filename}`);
  }

  // =======================================================
  // PAGE FILE DETECTION
  // =======================================================

  async function findLastPageNumber(BOOK_BASE, JSON_BASE, fallbackEndPage) {
    const nums = [];

    performance.getEntriesByType("resource").map(e => e.name).forEach(url => {
      const jsonMatch = url.match(/\/OPS\/json\/\d+-(\d+)_page\.json/);
      if (jsonMatch) nums.push(Number(jsonMatch[1]));

      const imageMatch = url.match(/page0*(\d+)\.(svgz|png|jpg|jpeg)/i);
      if (imageMatch) nums.push(Number(imageMatch[1]));
    });

    try {
      const opfResponse = await fetch(BOOK_BASE + "/OPS/content.opf");
      if (opfResponse.ok) {
        const opfText = await opfResponse.text();
        for (const match of opfText.matchAll(/page0*(\d+)\.(svgz|png|jpg|jpeg)/gi)) nums.push(Number(match[1]));
        for (const match of opfText.matchAll(/(\d+)-(\d+)_page\.json/g)) nums.push(Number(match[2]));
      }
    } catch (error) {
      console.warn("Could not read content.opf:", error);
    }

    try {
      const pageListResponse = await fetch(JSON_BASE + "/page-list.json");
      if (pageListResponse.ok) collectPageNumbers(await pageListResponse.json(), nums);
    } catch (error) {
      console.warn("Could not read page-list.json:", error);
    }

    const validNums = nums.filter(n => Number.isFinite(n) && n > 0);
    return validNums.length ? Math.max(...validNums) : fallbackEndPage;
  }

  function collectPageNumbers(obj, nums) {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) collectPageNumbers(item, nums);
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();

      if (typeof value === "number" && (keyLower.includes("page") || keyLower.includes("folio") || keyLower.includes("id"))) {
        nums.push(value);
      }

      if (typeof value === "string") {
        const pageMatch = value.match(/page0*(\d+)/i);
        if (pageMatch) nums.push(Number(pageMatch[1]));
        if (/^\d+$/.test(value) && keyLower.includes("page")) nums.push(Number(value));
      }

      collectPageNumbers(value, nums);
    }
  }

  async function getAvailablePageJsonFiles(START_PAGE, REAL_END_PAGE, LAST_PAGE) {
    const loaded = performance.getEntriesByType("resource").map(e => e.name).filter(url => /\/OPS\/json\/\d+-\d+_page\.json/.test(url));

    let files = [...new Set(loaded)].map(url => {
      const filename = url.split("/").pop();
      const match = filename.match(/^(\d+)-(\d+)_page\.json$/);
      if (!match) return null;
      return { filename, start: Number(match[1]), end: Number(match[2]) };
    }).filter(Boolean).sort((a, b) => a.start - b.start);

    if (!files.length) {
      const needed = new Map();
      for (let page = START_PAGE; page <= REAL_END_PAGE; page++) {
        const start = Math.floor((page - 1) / 100) * 100 + 1;
        const end = Math.min(start + 99, LAST_PAGE);
        needed.set(`${start}-${end}_page.json`, { filename: `${start}-${end}_page.json`, start, end });
      }
      files = [...needed.values()].sort((a, b) => a.start - b.start);
    }

    return files;
  }

  function getJsonFileForPage(pageJsonFiles, pageNum, LAST_PAGE) {
    const file = pageJsonFiles.find(item => pageNum >= item.start && pageNum <= item.end);
    if (file) return file.filename;

    const start = Math.floor((pageNum - 1) / 100) * 100 + 1;
    const end = Math.min(start + 99, LAST_PAGE);
    return `${start}-${end}_page.json`;
  }

  async function getJsonData(JSON_BASE, filename, jsonCache) {
    if (jsonCache[filename]) return jsonCache[filename];

    const response = await fetch(`${JSON_BASE}/${filename}`);
    if (!response.ok) throw new Error(`Could not fetch ${filename}. HTTP ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error(`${filename} was not an array.`);

    jsonCache[filename] = data;
    return data;
  }

  function findPage(data, pageNum) {
    return data.find(page => Number(page.page_id) === pageNum || Number(page.id) === pageNum || Number(page.pageId) === pageNum || Number(page.pageNumber) === pageNum);
  }

  // =======================================================
  // TEXT EXTRACTION
  // =======================================================

  function normalizeArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function extractLinesNormal(pageObj) {
    if (!pageObj) return [];

    const paras = normalizeArray(pageObj.pages?.page?.para);
    const linesOut = [];

    for (const para of paras) {
      const lines = normalizeArray(para.line);

      for (const line of lines) {
        const words = normalizeArray(line.word).filter(word => word && word.content).sort((a, b) => Number(a.x ?? 0) - Number(b.x ?? 0));
        const text = words.map(word => String(word.content)).join(" ").trim();
        if (!text) continue;

        linesOut.push({ text, y: Number(line.y ?? para.y ?? 0), x: Math.min(...words.map(word => Number(word.x ?? 0))) });
      }
    }

    linesOut.sort((a, b) => Math.abs(a.y - b.y) > 3 ? a.y - b.y : a.x - b.x);
    return linesOut.map(line => line.text);
  }

  function extractWordsRecursive(obj, words = []) {
    if (!obj || typeof obj !== "object") return words;

    if (Object.prototype.hasOwnProperty.call(obj, "content") && typeof obj.content === "string") {
      words.push({ text: obj.content, x: Number(obj.x ?? 0), y: Number(obj.y ?? 0) });
    }

    if (Array.isArray(obj)) for (const item of obj) extractWordsRecursive(item, words);
    else for (const key of Object.keys(obj)) extractWordsRecursive(obj[key], words);

    return words;
  }

  function extractLinesRobust(pageObj) {
    const words = extractWordsRecursive(pageObj);
    if (!words.length) return [];

    words.sort((a, b) => Math.abs(a.y - b.y) > 3 ? a.y - b.y : a.x - b.x);

    const lines = [];
    let current = [];
    let currentY = null;

    for (const word of words) {
      if (currentY === null || Math.abs(word.y - currentY) <= 3) {
        current.push(word);
        if (currentY === null) currentY = word.y;
      } else {
        current.sort((a, b) => a.x - b.x);
        lines.push(current.map(item => item.text).join(" "));
        current = [word];
        currentY = word.y;
      }
    }

    if (current.length) {
      current.sort((a, b) => a.x - b.x);
      lines.push(current.map(item => item.text).join(" "));
    }

    return lines;
  }

  function extractLinesFromPage(pageObj) {
    const normal = extractLinesNormal(pageObj);
    return normal.length ? normal : extractLinesRobust(pageObj);
  }

  // =======================================================
  // TOC AND MARKDOWN FORMATTING
  // =======================================================

  function getTocFromDom() {
    const rows = [...document.querySelectorAll(".chapterLabel, .subchapterLabel, .subChapterContent")].map(el => ({
      type: el.classList.contains("chapterLabel") ? "chapter" : el.classList.contains("subchapterLabel") ? "subchapter" : "content",
      text: cleanLine(el.innerText || "")
    })).filter(item => item.text && item.text.length > 2);

    const seen = new Set();
    const unique = [];
    for (const row of rows) {
      const key = row.type + "::" + row.text;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(row);
      }
    }
    return unique;
  }

  function findCertainTocTitleInLines(lines, tocRows) {
    const normalizedLines = lines.map(cleanLine).filter(Boolean).map(normalizeForCompare);
    const matches = [];

    for (let i = 0; i < tocRows.length; i++) {
      const toc = tocRows[i];
      const tocNorm = normalizeForCompare(toc.text);
      if (tocNorm.length < 4) continue;

      for (const lineNorm of normalizedLines) {
        if (lineNorm === tocNorm || (tocNorm.length >= 12 && (lineNorm.startsWith(tocNorm + " ") || lineNorm.startsWith(tocNorm + ":")))) {
          matches.push({ ...toc, index: i });
          break;
        }
      }
    }

    if (!matches.length) return null;

    const rank = { chapter: 1, subchapter: 2, content: 3 };
    matches.sort((a, b) => (rank[b.type] - rank[a.type]) || (b.text.length - a.text.length));
    return matches[0];
  }

  function removeCertainHeadingLine(lines, headingText) {
    const headingNorm = normalizeForCompare(headingText);
    return lines.filter(line => {
      const lineNorm = normalizeForCompare(line);
      return !(lineNorm === headingNorm || lineNorm.startsWith(headingNorm + " "));
    });
  }

  function formatSection(section) {
    const prefix = section.type === "content" ? "####" : section.type === "subchapter" ? "###" : "##";
    const title = escapeMarkdownHeading(section.title);
    const lines = section.lines.map(cleanLine).filter(Boolean);
    const deduped = [];
    for (const line of lines) {
      if (deduped[deduped.length - 1] !== line) deduped.push(line);
    }
    return `${prefix} ${title}\n\n${deduped.join("\n")}`.trim();
  }

  function cleanLine(line) {
    return String(line)
      .replaceAll("¼", "=")
      .replaceAll("þ", "+")
      .replaceAll("ð", "(")
      .replaceAll("Þ", ")")
      .replaceAll("’", "φ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeForCompare(text) {
    return cleanLine(text).toLowerCase().replace(/[.,:;!?()[\]{}«»"']/g, "").replace(/\s+/g, " ").trim();
  }

  function escapeMarkdownHeading(text) {
    return cleanLine(text).replace(/^#+\s*/, "");
  }

  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }
})();
