/// book-exporter.js
(function () {
    "use strict";
    if (window.__bookExporterUboLoaded) {
        return;
    }
    window.__bookExporterUboLoaded = true;
    var ROUTER_URL = "https://raw.githubusercontent.com/fordi-off/unibok-downloader/main/src/book-exporter-router.js";
    fetch(ROUTER_URL + "?t=" + Date.now())
        .then(function (response) {
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            return response.text();
        })
        .then(function (code) {
            var script = document.createElement("script");
            script.textContent = code;
            document.documentElement.appendChild(script);
            script.remove();
            console.log("Book Exporter router loaded from GitHub (uBlock Origin scriptlet).");
        })
        .catch(function (error) {
            console.error("Book Exporter: could not load router via uBlock Origin scriptlet.", error);
        });
})();
