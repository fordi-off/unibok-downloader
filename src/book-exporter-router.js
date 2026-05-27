(function () {
  "use strict";

  // =======================================================
  // SETUP VARIABLES
  // =======================================================

  const SETUP = {
    // Change this after uploading the project to GitHub.
    githubRawBase: "https://raw.githubusercontent.com/fordi-off/unibok-downloader/main",

    // Local files inside this repo.
    unibokScriptPath: "src/unibok-downloader.js",
    smartbokScriptPath: "src/smartbok-exporter.js",

    // Prevent loading the same module multiple times.
    routerFlag: "__bookExporterRouterLoaded"
  };

  // =======================================================
  // ROUTER
  // =======================================================

  if (window[SETUP.routerFlag]) {
    console.log("Book Exporter router is already loaded.");
    return;
  }

  window[SETUP.routerFlag] = true;

  const host = window.location.hostname;

  if (host === "les.unibok.no" || host.endsWith(".unibok.no")) {
    loadScriptFromRepo(SETUP.unibokScriptPath, "Unibok exporter");
    return;
  }

  if (host === "bok2.smartbok.no" || host === "www.smartbok.no" || host.endsWith(".smartbok.no")) {
    loadScriptFromRepo(SETUP.smartbokScriptPath, "Smartbok exporter");
    return;
  }

  console.log("Book Exporter: unsupported site:", host);

  // =======================================================
  // LOADER
  // =======================================================

  function loadScriptFromRepo(path, label) {
    const url = `${SETUP.githubRawBase.replace(/\/$/, "")}/${path.replace(/^\//, "")}?t=${Date.now()}`;

    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`${label} could not be loaded. HTTP ${response.status}`);
        }
        return response.text();
      })
      .then(code => {
        const script = document.createElement("script");
        script.textContent = code;
        document.documentElement.appendChild(script);
        script.remove();
        console.log(`${label} loaded from:`, url);
      })
      .catch(error => {
        console.error(error);
        alert(`${label} could not be loaded. Check githubRawBase in src/book-exporter-router.js.`);
      });
  }
})();
