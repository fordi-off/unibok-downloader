# 📚 Unibok Book Downloader

> A Tampermonkey userscript that lets you download offline books from [unibok.no](https://les.unibok.no) as readable HTML files — copyable text, openable in any browser, Word, or text editor.

![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-compatible-blue)
![Platform](https://img.shields.io/badge/site-unibok.no-orange)

---

## ✨ Features

- 🟢 Floating **Download Book** button appears on every page
- 📋 Shows a **list of all books** you have saved for offline use
- 📄 Downloads as a clean, readable **HTML file**
- ✂️ Fully **copy-pasteable** text — works in Word, Google Docs, text editors
- 🖨️ Print to PDF straight from your browser
- 🔄 Script is loaded from GitHub — **updates automatically**, no reinstall needed

---

## 📋 Requirements

- [Tampermonkey](https://www.tampermonkey.net/) browser extension (Chrome, Firefox, Edge, Safari)
- A [unibok.no](https://les.unibok.no) account with at least one book downloaded for **offline use**

> **How to download a book for offline use on unibok.no:**  
> Open a book → click the **cloud/download icon** in the reader toolbar → wait for it to finish downloading.

---

## 🚀 Installation

### Step 1 — Install Tampermonkey

| Browser | Link |
|---------|------|
| Chrome | [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) |
| Edge | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |

### Step 2 — Install the userscript

1. Click the **Tampermonkey icon** in your browser toolbar
2. Select **Create a new script**
3. Delete all existing content in the editor
4. Copy and paste the contents of [`tampermonkey.user.js`](./tampermonkey.user.js)
5. Replace `YOUR_USERNAME` with your actual GitHub username (2 places)
6. Press **Ctrl + S** (or Cmd + S) to save

> **Alternative:** If Tampermonkey supports direct installs from raw URLs, you can navigate to the raw `tampermonkey.user.js` file and Tampermonkey may prompt you to install it automatically.

### Step 3 — Use it

1. Go to [les.unibok.no](https://les.unibok.no) and open any book
2. A **green button** appears in the bottom-right corner of the page
3. Click it → a popup shows all your offline-downloaded books
4. Click **⬇ Download** next to the book you want
5. The file saves as `BookTitle.html` in your downloads folder

---

## 📁 Repository Structure

```
unibok-downloader/
├── unibok-downloader.js   ← Full script logic (loaded by Tampermonkey)
├── tampermonkey.user.js   ← Tiny installer script (paste into Tampermonkey)
└── README.md
```

---

## 🔧 How It Works

Unibok stores offline books in the browser's **IndexedDB** using [localForage](https://github.com/localForage/localForage), with one database per book (`bookId_XXXXX`). Each database contains the full EPUB content — HTML chapters, images, and an OPF manifest.

This script:
1. Scans all `bookId_*` IndexedDB databases and finds ones with content
2. Reads the EPUB OPF manifest to get the correct chapter order
3. Assembles all chapters into a single styled HTML file
4. Triggers a browser download

---

## 🔄 Updating

Because Tampermonkey loads the script directly from GitHub via `@require`, **you never need to reinstall**. Just push changes to `unibok-downloader.js` and the next page load will use the new version.

> Note: Tampermonkey may cache `@require` scripts for a few hours. To force an immediate update, go to Tampermonkey → your script → **check for updates**.

---

## ⚠️ Notes

- Only books downloaded for **offline use** can be extracted (the cloud icon in the reader)
- Images in the downloaded HTML file will not load (they are stored as binary blobs, not linked URLs)
- This tool reads data already stored on your own computer — it does not make any network requests to unibok's servers

---

## 📄 License

MIT — do whatever you want with it.
