# Welcome to the DB-less Wiki

This is a modern, fast, and fully customizable wiki system that runs entirely without a database. All your content is stored as simple markdown files in the `docs/` folder, and assets are cleanly organized in `public/uploads/`.

## Key Features

### 1. DB-less Architecture & Markdown Support
- **Filesystem as Database**: Just create or edit `.md` files in the `docs` folder. The sidebar tree automatically updates!
- **Rich Markdown**: Supports headers, lists, **bold text**, *italics*, tables, and inline images.
- **In-Browser Editor**: Log in via the top-right Admin icon to create, edit, and upload images directly from the browser.

### 2. Deep Customization (Settings)
Click the **Settings (gear) icon** at the top right to personalize your wiki:
- **Site Title**: Change the top-left title dynamically.
- **Primary Color**: Use the color picker to completely re-theme the UI using Material 3's dynamic color system.
- **Custom Fonts**: Upload your own `.ttf` or `.woff` files. They maintain their original filenames and apply globally to the UI and content.
- **Custom Favicon**: Upload an icon to change the browser tab logo (saved securely in `/uploads/favicons/`).

### 3. Smart Theme Modes & Auto-Schedule
The wiki supports Light and Dark modes, but you can also automate it:
- **System Default**: Follows your OS settings.
- **Schedule (Time-based)**: Tell the wiki when you want Dark Mode to begin and end (e.g., Start at 18:00, End at 06:00). 
  - *Note: The wiki checks the time every minute and will automatically switch themes even if you just leave the page open!*

### 4. Dynamic Time Macros
You can use special macro tags inside any markdown file to automatically calculate dates and times based on the viewer's local clock:

- **`{{NOW}}`**: Displays the current exact time. 
  - *Result*: {{NOW}}
- **`{{DDAY:YYYY-MM-DD}}`**: Displays a standard D-Day format.
  - *Example (`{{DDAY:2024-01-01}}`)*: {{DDAY:2024-01-01}}
  - *Example (`{{DDAY:2099-12-31}}`)*: {{DDAY:2099-12-31}}
- **`{{DAYS_SINCE:YYYY-MM-DD}}`**: Returns only the number of days passed.
  - *Example (`{{DAYS_SINCE:2024-01-01}}`)*: {{DAYS_SINCE:2024-01-01}} days ago.
- **`{{DAYS_UNTIL:YYYY-MM-DD}}`**: Returns only the number of days remaining.
  - *Example (`{{DAYS_UNTIL:2099-12-31}}`)*: {{DAYS_UNTIL:2099-12-31}} days left.

---

### Code Example
```javascript
console.log("Hello World!");
```

### Table
| Feature | Supported |
|---------|-----------|
| SPA Navigation | Yes |
| Real-time Editing | Yes |
| Glassmorphism UI | Yes |

Enjoy writing!
