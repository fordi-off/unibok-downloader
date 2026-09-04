# Book Exporter: Unibok + Smartbok

This project gives you one Tampermonkey loader that automatically runs the correct exporter depending on the website you are currently using.

- On `les.unibok.no`, it loads the Unibok exporter.
- On `bok2.smartbok.no` or `www.smartbok.no`, it loads the Smartbok exporter.

The Tampermonkey script itself stays small. It only loads `src/book-exporter-router.js` from your GitHub repo. The router then loads the correct local module from the same repo.

## Project structure

```text
book-exporter/
├── README.md
├── LICENSE
├── tampermonkey.user.js
└── src/
    ├── book-exporter-router.js
    ├── smartbok-exporter.js
    ├── unibok-downloader.js
    └── ublock-scriptlets.js
```

## Important setup

After uploading this project to GitHub, you must edit two URLs.

### 1. Edit `tampermonkey.user.js`

Change this:

```js
const ROUTER_URL =
  "https://raw.githubusercontent.com/YOUR_USERNAME/book-exporter/main/src/book-exporter-router.js";
```

to your real raw GitHub URL, for example:

```js
const ROUTER_URL =
  "https://raw.githubusercontent.com/nikitaradchenko2/book-exporter/main/src/book-exporter-router.js";
```

### 2. Edit `src/book-exporter-router.js`

Change this:

```js
githubRawBase: "https://raw.githubusercontent.com/YOUR_USERNAME/book-exporter/main",
```

to your real repo base URL, for example:

```js
githubRawBase: "https://raw.githubusercontent.com/nikitaradchenko2/book-exporter/main",
```

## How to install

1. Create a new GitHub repo, for example `book-exporter`.
2. Upload all files from this package to the repo.
3. Open `tampermonkey.user.js` and update `ROUTER_URL`.
4. Open `src/book-exporter-router.js` and update `githubRawBase`.
5. Open `tampermonkey.user.js` in GitHub, press **Raw**, and copy the raw URL.
6. Open Tampermonkey.
7. Create a new userscript.
8. Paste the contents of `tampermonkey.user.js` into Tampermonkey.
9. Save it.
10. Open Unibok or Smartbok.

## How it works

### Router

`src/book-exporter-router.js` checks the current domain:

- `les.unibok.no` loads `src/unibok-downloader.js`
- `bok2.smartbok.no` / `www.smartbok.no` loads `src/smartbok-exporter.js`

### Unibok exporter

The Unibok exporter looks for offline Unibok books stored in browser IndexedDB databases named like `bookId_*`. It creates a button, scans the offline storage, and lets you export an AI-friendly text/HTML version or a reader-style HTML version.

### Smartbok exporter

The Smartbok exporter adds a button to the Smartbok page. When you press it, it asks for a start page and end page. It then reads the Smartbok text layer files from `OPS/json`, groups the text by safe chapter/title matches when possible, and downloads a Markdown file.

The Smartbok exporter has a page limit at the top of `src/smartbok-exporter.js`:

```js
maxPages: 20,
```

This is there to prevent accidental huge exports.

## Setup variables

Each JavaScript file has setup variables at the top:

- `tampermonkey.user.js`: `ROUTER_URL`
- `src/book-exporter-router.js`: `githubRawBase`, script paths
- `src/smartbok-exporter.js`: default pages, max pages, file type, button text
- `src/unibok-downloader.js`: button text and UI settings
- `src/ublock-scriptlets.js`: `ROUTER_URL` (only needed if you use uBlock Origin instead of Tampermonkey)

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

If you don't want to install Tampermonkey, uBlock Origin can inject the same loader through its own scriptlet injection feature (`##+js(...)` filters). This uses `src/ublock-scriptlets.js`, which loads the router with `fetch()` instead of `GM_xmlhttpRequest` since scriptlets already run in the page's own JavaScript context.

1. Open uBlock Origin's dashboard → **Settings** and enable **I am an advanced user**.
2. Click the gear icon that appears next to that setting to open **Advanced settings**.
3. Set `userResourcesLocation` to the raw URL of your `src/ublock-scriptlets.js`, for example:

   ```text
   https://raw.githubusercontent.com/nikitaradchenko2/book-exporter/main/src/ublock-scriptlets.js
   ```

   This adds `book-exporter.js` to uBlock Origin's available scriptlets without removing the built-in ones.
4. Go to the **My filters** tab and add one rule per site you want the loader on:

   ```text
   les.unibok.no##+js(book-exporter)
   bok2.smartbok.no##+js(book-exporter)
   www.smartbok.no##+js(book-exporter)
   ```

5. Save, then reload the page. uBlock Origin will inject and run the loader the same way the Tampermonkey script does.

If you also edit `githubRawBase` in `src/book-exporter-router.js` per the setup steps above, update the `ROUTER_URL` in `src/ublock-scriptlets.js` to match.

## Notes

Use this only with books and pages you are allowed to access and export. The scripts do not provide access to books you are not already able to open in your browser.
