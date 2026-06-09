# Private Wiki Lite User & Operator Manual

This document explains how to operate and use the **Private Wiki Lite**, which is optimized for **Static Web Hosting** environments such as GitHub Pages, Vercel, and others.

This version runs entirely on vanilla HTML, CSS, and JS without a backend server (Node.js). For security and ease of management, all file editing and uploading features have been completely removed from the web UI, making this a "Read-Only" deployment version.

---

## 1. Static Wiki Structure & Document Creation

Because this wiki lacks a database and an online editor, administrators must manually write Markdown (`.md`) files on their local computers and upload (commit/push) them to GitHub.

### 1.1 Managing Folders and Documents
All wiki documents are managed inside the `docs/` folder.
- Create new folders or markdown files (e.g., `document_name.md`) directly inside the `docs/` folder.
- The folder and file structure you create will be perfectly mirrored in the left sidebar's **Tree Menu (Table of Contents)** on the website.
- Image files can also be placed inside the `docs/` folder and referenced using relative paths in your Markdown, or you can create an `assets/images/` folder to manage them centrally.

### 1.2 Updating Search and Navigation Data (Required)
Whenever you create, rename, or delete a document, you must update the navigation tree (`tree.json`) and the search index (`search_index.json`) so the wiki is aware of the changes.

**[Automatic Update - Using GitHub Pages]**
- When you push your code to GitHub, GitHub Actions will automatically run the build script to update the file tree and search data. (No manual action required)

**[Manual Update - Local Testing or Other Hosting]**
- Open your terminal, navigate to the `/` folder, and run the following command:
  ```bash
  node ghp_build.js
  ```
- After running the script, verify that `tree.json` and `search_index.json` have been newly generated or updated, and then deploy the site.

---

## 2. Managing Global Site Settings (`settings.json`)

All global configurations (like setting the homepage) that were previously in the web UI have been consolidated into a single configuration file.
To change the overarching site settings, you must directly edit the `settings.json` text file.

```json
{
  "siteTitle": "My Awesome Wiki",
  "homeDocument": "folder1/welcome.md",
  "faviconUrl": "assets/favicons/favicon.ico",
  "customFontUrl": "assets/fonts/myfont.woff2",
  "customFont": "NanumGothic"
}
```
- **siteTitle:** The name of the site displayed in the browser tab and the top left corner.
- **homeDocument:** The path to the main document to load upon first access. (Paths should be relative to the `docs/` folder, e.g., `welcome.md`).
- **faviconUrl:** The path to the favicon image displayed in the browser tab. (You can provide an absolute URL or a path relative to the `/` folder.)
- **customFontUrl:** The path to your custom font file.
- **customFont:** Assign a name to your custom font. (English names are recommended.)

*(Note: Personal preferences such as Theme Mode or the Primary Color Palette can still be set individually by each user clicking the Gear (Settings) icon in the top right corner of the browser.)*

---

## 3. Basic Usage & Macro Features

Even in the static version, document reading, inner Table of Contents (TOC) scrolling, and search functionality work identically to the full version.

Additionally, if you manually type the following macro syntax directly into your Markdown files, you can utilize the exact same dynamic features.

**1. Redirect (Auto Document Forwarding)**
Write this at the very top of a document to force-redirect anyone who accesses it to a new location.
```markdown
{'{REDIRECT:new_folder/new_document.md}'}
```

**2. D-Day Calculator**
Automatically calculates and displays the number of days remaining until (or passed since) a specific date.
```markdown
There are {{DAYS_UNTIL:2026-10-31}} days left until the festival!
```
