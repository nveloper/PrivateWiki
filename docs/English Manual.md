# Private Wiki User & Operator Manual

This document explains how to operate and use the **Private Wiki**, which is powered by a Node.js backend server. It operates entirely without a database by exclusively using Markdown (`.md`) files. This version allows you to directly create, edit, and delete documents straight from the web UI.

---

## 1. Running the Server & Initial Setup

### 1.1 How to Start the Server
1. Open your terminal and navigate to the project's root folder (`/`).
2. Run `npm install` to install the necessary dependencies.
3. Start the server by running `node server.js`.
4. Open your browser and go to `http://localhost:8180`.

### 1.2 Administrator Login (Edit Permissions)
To edit, delete, or create new documents, you must log in by clicking the **Padlock (Login)** icon in the top right corner.
- **Default Password:** `admin`
- **How to change the password:** Once the server is run for the first time, an `auth.json` file is automatically generated in the project root. Open this file, change the password, and restart the server to apply the changes.

---

## 2. Basic Usage (Using the Wiki)

### 2.1 Reading and Navigating
- **Sidebar (File Tree):** Use the tree structure on the left to navigate through folders and documents.
- **Table of Contents (TOC):** If you use heading tags (`#`) in your Markdown, a TOC button will appear in the bottom right corner. Clicking it will smoothly scroll you to the selected section.
- **Search:** Click the magnifying glass icon at the top to search the contents of all documents in the wiki.
- **Random Document:** Click the dice icon at the top to display a randomly selected document from the wiki.

### 2.2 Document Management (Admin Only)
Once logged in, the following features will be activated:
- **Edit Document:** Click the pencil icon in the bottom right corner to open the Markdown editor.
- **Create Items:** Click the `+` button next to a folder in the file tree to create a new folder or `.md` file.
- **Rename/Delete:** Click the gear icon next to a document or folder name to rename or delete it.

### 2.3 Image Uploads
You can upload images to the server using the **Image Upload** button at the bottom of the edit mode.
- Upon successful upload, a markdown code snippet like `![image_name](/uploads/images/filename.png)` is automatically generated. You can simply copy and paste this into your document.

---

## 3. UI and Theme Settings

Click the **Gear (Settings)** icon in the top right corner to change site-wide settings.
(These settings are saved to the server's `settings.json` and applied to all users. Note: Theme mode and color palette are saved only to your personal browser.)

- **Site Title:** Sets the name displayed on the browser tab and the top left of the site.
- **Home Document:** Sets the main document to load upon first access (e.g., `folder1/welcome.md`).
- **Theme Mode:** 
  - `System`: Follows the operating system's dark mode preference.
  - `Light` / `Dark`: Permanently fixes the theme to light or dark mode.
  - `Schedule`: Automatically switches to dark mode during specified hours (e.g., 18:00 to 06:00).
- **Primary Color:** Changes the primary accent color of the site (buttons, selected folders, etc.).
- **Font & Favicon Upload:** Allows you to upload custom font files or favicon images from your computer and apply them immediately.

---

## 4. Special Macro Features

Typing specific text phrases into your Markdown files activates dynamic features.

**1. Redirect Macro**
Automatically redirects users to a different document when they access the current one.
```markdown
{'{REDIRECT:folder_name/target_document.md}'}
```

**2. D-Day Countdown Macro**
Automatically calculates and displays the number of days remaining until (or passed since) a specific date.
```markdown
There are {{DAYS_UNTIL:2026-12-25}} days left until Christmas!
```
