(function () {
  "use strict";

  // =======================================================
  // SETUP VARIABLES
  // =======================================================

  const SETUP = {
    buttonText: "Download Smartbok excerpt",
    defaultStartPage: 1,
    defaultEndPage: 10,
    maxPages: 20,
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
    button.addEventListener("click", runPrompt);

    document.body.appendChild(button);
    console.log("Smartbok exporter button created.");
  }

  async function runPrompt() {
    try {
      const startRaw = prompt("Start page:", String(SETUP.defaultStartPage));
      if (startRaw === null) return;

      const endRaw = prompt("End page:", String(SETUP.defaultEndPage));
      if (endRaw === null) return;

      const startPage = Number(startRaw);
      const endPage = Number(endRaw);

      if (!Number.isInteger(startPage) || !Number.isInteger(endPage)) {
        alert("Start page and end page must be whole numbers.");
        return;
      }

      await exportRange(startPage, endPage);
    } catch (error) {
      console.error("[Smartbok exporter]", error);
      alert("Error: " + error.message);
    }
  }

  // =======================================================
  // MAIN EXPORT
  // =======================================================

  async function exportRange(START_PAGE, END_PAGE) {
    const cloudBookPath = sessionStorage.getItem("cloudBookPATH");
    const bookTitle = sessionStorage.getItem("bookTitle") || document.title || "Smartbok excerpt";

    if (!cloudBookPath) {
      throw new Error("Could not find cloudBookPATH. Open a Smartbok book first.");
    }

    if (START_PAGE < 1 || END_PAGE < 1) {
      throw new Error("Page numbers must be 1 or higher.");
    }

    if (END_PAGE < START_PAGE) {
      throw new Error("End page cannot be lower than start page.");
    }

    const BOOK_BASE = cloudBookPath.replace(/\/$/, "");
    const JSON_BASE = BOOK_BASE + "/OPS/json";

    const LAST_PAGE = await findLastPageNumber(BOOK_BASE, JSON_BASE, END_PAGE);
    const REAL_END_PAGE = Math.min(END_PAGE, LAST_PAGE);

    if (START_PAGE > LAST_PAGE) {
      throw new Error(`Start page is higher than the last detected page (${LAST_PAGE}).`);
    }

    if (REAL_END_PAGE - START_PAGE + 1 > SETUP.maxPages) {
      throw new Error(`Too many pages selected (${START_PAGE}-${REAL_END_PAGE}). Maximum is ${SETUP.maxPages} pages at once.`);
    }

    const pageJsonFiles = await getAvailablePageJsonFiles(START_PAGE, REAL_END_PAGE, LAST_PAGE);
    const tocRows = getTocFromDom();
    const jsonCache = {};
    const sections = [];

    let currentSection = {
      title: "No certain chapter detected",
      type: "unknown",
      lines: []
    };

    function pushCurrentSection() {
      if (currentSection.lines.some(line => cleanLine(line))) {
        sections.push(currentSection);
      }
    }

    for (let pageNum = START_PAGE; pageNum <= REAL_END_PAGE; pageNum++) {
      const filename = getJsonFileForPage(pageJsonFiles, pageNum, LAST_PAGE);
      const data = await getJsonData(JSON_BASE, filename, jsonCache);
      const page = findPage(data, pageNum);

      if (!page) continue;

      let lines = extractLinesFromPage(page).map(cleanLine).filter(Boolean);
      if (!lines.length) continue;

      const title = findCertainTocTitleInLines(lines, tocRows);

      if (title) {
        pushCurrentSection();
        currentSection = { title: title.text, type: title.type, lines: [] };
        lines = removeCertainHeadingLine(lines, title.text);
      }

      currentSection.lines.push(...lines);
    }

    pushCurrentSection();

    let output = "";
    output += `# ${escapeMarkdownHeading(bookTitle)}\n\n`;
    output += `Excerpt from selected page range: ${START_PAGE}–${REAL_END_PAGE}.\n\n`;
    output += sections.map(formatSection).join("\n\n---\n\n");

    console.log(output);

    try {
      await navigator.clipboard.writeText(output);
      console.log("Excerpt copied to clipboard.");
    } catch (error) {
      console.warn("Could not copy to clipboard:", error);
    }

    const safeBookTitle = bookTitle.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 60);
    const filename = `${safeBookTitle}_${START_PAGE}-${REAL_END_PAGE}.${SETUP.fileType}`;
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
