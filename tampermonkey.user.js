// ==UserScript==
// @name         Book Exporter Loader - Unibok + Smartbok
// @namespace    https://github.com/fordi-off/unibok-downloader
// @version      1.0.0
// @description  Loads the correct exporter from your GitHub repo depending on the current site.
// @match        https://les.unibok.no/*
// @match        https://bok2.smartbok.no/*
// @match        https://www.smartbok.no/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // Change this after you upload the project to your own GitHub repo.
  const ROUTER_URL =
    "https://raw.githubusercontent.com/fordi-off/unibok-downloader/main/src/book-exporter-router.js";

  GM_xmlhttpRequest({
    method: "GET",
    url: ROUTER_URL + "?t=" + Date.now(),
    onload(response) {
      if (response.status !== 200) {
        console.error("Could not load router:", response.status, response.responseText);
        alert("Could not load Book Exporter from GitHub. Check ROUTER_URL.");
        return;
      }

      const script = document.createElement("script");
      script.textContent = response.responseText;
      document.documentElement.appendChild(script);
      script.remove();

      console.log("Book Exporter router loaded from GitHub.");
    },
    onerror(error) {
      console.error("Network error while loading router:", error);
      alert("Network error while loading Book Exporter from GitHub.");
    }
  });
})();
