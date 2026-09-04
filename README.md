# Book Exporter: Unibok + Smartbok

This project gives you one Tampermonkey loader that automatically runs the correct exporter depending on the website you are currently using.

- On `les.unibok.no`, it loads the Unibok exporter.
- On `bok2.smartbok.no` or `www.smartbok.no`, it loads the Smartbok exporter.

The Tampermonkey script itself stays small. It only loads `src/book-exporter-router.js` from this repo (`fordi-off/unibok-downloader`) on GitHub. The router then loads the correct local module from the same repo. Everything already points at this repo, so you can install it directly without forking or editing any URLs.

## Project structure

```text
unibok-downloader/
├── README.md
├── LICENSE
├── tampermonkey.user.js
└── src/
    ├── book-exporter-router.js
    ├── smartbok-exporter.js
    ├── unibok-downloader.js
    └── ublock-scriptlets.js
```

## How to install

1. Open [`tampermonkey.user.js`](tampermonkey.user.js) in this repo on GitHub and press **Raw**.
2. Open Tampermonkey, create a new userscript, and paste in the contents of that raw file.
3. Save it.
4. Open Unibok or Smartbok.

That's it — the script pulls everything else it needs (the router and the site-specific exporter) live from this repo, so updates to this repo reach you automatically without reinstalling.

### Running your own fork instead

If you fork this repo and want your fork's copy to be used instead, update the URLs so they point at your fork:

- `tampermonkey.user.js`: change `ROUTER_URL` to your fork's raw URL for `src/book-exporter-router.js`.
- `src/book-exporter-router.js`: change `githubRawBase` to your fork's raw base URL.
- `src/ublock-scriptlets.js`: change `ROUTER_URL` to match, if you're using the uBlock Origin method below.

## How it works

### Router

`src/book-exporter-router.js` checks the current domain:

- `les.unibok.no` loads `src/unibok-downloader.js`
- `bok2.smartbok.no` / `www.smartbok.no` loads `src/smartbok-exporter.js`

### Unibok exporter

The Unibok exporter looks for offline Unibok books stored in browser IndexedDB databases named like `bookId_*`. It creates a button, scans the offline storage, and lets you export an AI-friendly text/HTML version or a reader-style HTML version.

### Smartbok exporter

The Smartbok exporter adds a button to the Smartbok page. When you press it, it scans the book and opens a window listing every detected chapter and subchapter with its page range. Check the ones you want, then press **Download selected**. It reads the Smartbok text layer files from `OPS/json`, groups the text by safe chapter/title matches, and downloads a Markdown file containing only the chapters you selected.

## Setup variables

Each JavaScript file has setup variables at the top. You only need to touch these if you're running your own fork (see [Running your own fork instead](#running-your-own-fork-instead)):

- `tampermonkey.user.js`: `ROUTER_URL`
- `src/book-exporter-router.js`: `githubRawBase`, script paths
- `src/smartbok-exporter.js`: file type, button text
- `src/unibok-downloader.js`: button text and UI settings
- `src/ublock-scriptlets.js`: `ROUTER_URL`

## File format

Smartbok downloads as Markdown by default:

```js
fileType: "md"
```

You can change it to:

```js
fileType: "txt"
```

## Using uBlock Origin instead of Tampermonkey

If you don't want to install Tampermonkey, uBlock Origin can inject the same loader through its own scriptlet injection feature (`##+js(...)` filters). This uses `src/ublock-scriptlets.js`, which loads the router with `fetch()` instead of `GM_xmlhttpRequest` since scriptlets already run in the page's own JavaScript context. It already points at this repo, so no editing is needed.

1. Open uBlock Origin's dashboard → **Settings** and enable **I am an advanced user**.
2. Click the gear icon that appears next to that setting to open **Advanced settings**.
3. Set `userResourcesLocation` to this repo's raw URL for `src/ublock-scriptlets.js`:

   ```text
   https://raw.githubusercontent.com/fordi-off/unibok-downloader/main/src/ublock-scriptlets.js
   ```

   This adds `book-exporter.js` to uBlock Origin's available scriptlets without removing the built-in ones.
4. Go to the **My filters** tab and add one rule per site you want the loader on:

   ```text
   les.unibok.no##+js(book-exporter)
   bok2.smartbok.no##+js(book-exporter)
   www.smartbok.no##+js(book-exporter)
   ```

5. Save, then reload the page. uBlock Origin will inject and run the loader the same way the Tampermonkey script does.

## Notes

Use this only with books and pages you are allowed to access and export. The scripts do not provide access to books you are not already able to open in your browser.
