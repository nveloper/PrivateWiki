const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
let currentAuthToken = null;
const PORT = process.env.PORT || 8180;
// Allow passing DOCS_DIR via command line argument (e.g., node server.js Z:\NAS\Wiki)
const DOCS_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'docs');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const IMAGES_DIR = path.join(UPLOADS_DIR, 'images');
const FONTS_DIR = path.join(UPLOADS_DIR, 'fonts');
const FAVICONS_DIR = path.join(UPLOADS_DIR, 'favicons');

// Create required directories if they don't exist
[DOCS_DIR, UPLOADS_DIR, IMAGES_DIR, FONTS_DIR, FAVICONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'font') {
      cb(null, FONTS_DIR);
    } else if (file.fieldname === 'image') {
      cb(null, IMAGES_DIR);
    } else if (file.fieldname === 'favicon') {
      cb(null, FAVICONS_DIR);
    } else {
      cb(new Error('Invalid fieldname'), UPLOADS_DIR);
    }
  },
  filename: function (req, file, cb) {
    if (file.fieldname === 'font' || file.fieldname === 'favicon') {
      cb(null, file.originalname);
    } else {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.static('public'));

// Recursively build the file tree
function buildTree(dirPath, basePath = '') {
  const items = fs.readdirSync(dirPath).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const tree = [];

  items.forEach(item => {
    if (item === 'stylesheets' || item.startsWith('.')) return;

    const fullPath = path.join(dirPath, item);
    const relPath = path.posix.join(basePath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const children = buildTree(fullPath, relPath);
      tree.push({
        type: 'folder',
        name: item,
        path: relPath,
        children: children
      });
    } else if (item.toLowerCase().endsWith('.md')) {
      tree.push({
        type: 'file',
        name: item.replace(/\.md$/i, ''),
        path: relPath
      });
    }
  });

  // Sort folders first, then files
  tree.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === 'folder' ? -1 : 1;
  });

  return tree;
}

// API: Get file tree
app.get('/api/tree', (req, res) => {
  try {
    const tree = buildTree(DOCS_DIR);
    res.json(tree);
  } catch (error) {
    console.error('Error reading tree:', error);
    res.status(500).json({ error: 'Failed to read directory structure' });
  }
});

// Search recursively
function searchFiles(dirPath, query, basePath = '', results = []) {
  const items = fs.readdirSync(dirPath);
  const lowerQuery = query.toLowerCase();

  items.forEach(item => {
    if (item === 'stylesheets' || item.startsWith('.')) return;
    const fullPath = path.join(dirPath, item);
    const relPath = path.posix.join(basePath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      searchFiles(fullPath, query, relPath, results);
    } else if (item.toLowerCase().endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lowerContent = content.toLowerCase();
      const lowerName = item.toLowerCase();
      
      let snippet = null;
      if (lowerName.includes(lowerQuery)) {
        snippet = "Matched in title";
      } else if (lowerContent.includes(lowerQuery)) {
        const index = lowerContent.indexOf(lowerQuery);
        const start = Math.max(0, index - 30);
        const end = Math.min(content.length, index + query.length + 30);
        snippet = (start > 0 ? '...' : '') + content.substring(start, end).replace(/\n/g, ' ') + (end < content.length ? '...' : '');
      }

      if (snippet !== null) {
        results.push({
          path: relPath,
          name: item.replace(/\.md$/i, ''),
          snippet: snippet
        });
      }
    }
  });
  return results;
}

// API: Search
app.get('/api/search', (req, res) => {
  const query = req.query.q;
  if (!query || query.trim().length === 0) {
    return res.json([]);
  }
  try {
    const results = searchFiles(DOCS_DIR, query.trim());
    res.json(results);
  } catch (error) {
    console.error('Error searching files:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// API: Get file content
app.get('/api/content', (req, res) => {
  const filePathParam = req.query.path;
  if (!filePathParam) {
    return res.status(400).json({ error: 'Path parameter is required' });
  }

  // Prevent directory traversal attacks by resolving against DOCS_DIR
  const resolvedPath = path.resolve(DOCS_DIR, filePathParam);
  if (!resolvedPath.startsWith(DOCS_DIR) || !resolvedPath.toLowerCase().endsWith('.md')) {
    return res.status(403).json({ error: 'Access denied or invalid file type' });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const stat = fs.statSync(resolvedPath);
    res.json({
      content: content,
      lastModified: stat.mtimeMs
    });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Middleware to check auth
function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  if (currentAuthToken && token === `Bearer ${currentAuthToken}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// API: Save file content
app.post('/api/content', requireAuth, (req, res) => {
  const filePathParam = req.body.path;
  const newContent = req.body.content;

  if (!filePathParam || typeof newContent !== 'string') {
    return res.status(400).json({ error: 'Path and content are required' });
  }

  const resolvedPath = path.resolve(DOCS_DIR, filePathParam);
  if (!resolvedPath.startsWith(DOCS_DIR) || !resolvedPath.toLowerCase().endsWith('.md')) {
    return res.status(403).json({ error: 'Access denied or invalid file type' });
  }

  try {
    fs.writeFileSync(resolvedPath, newContent, 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error writing file:', error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// API: Create Folder
app.post('/api/create/folder', requireAuth, (req, res) => {
  const targetPath = req.body.path; // Parent directory
  const folderName = req.body.name;

  if (!folderName) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  // If targetPath is empty, it means root (DOCS_DIR)
  const parentDir = targetPath ? path.resolve(DOCS_DIR, targetPath) : DOCS_DIR;
  if (!parentDir.startsWith(DOCS_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const newFolderPath = path.join(parentDir, folderName);
  
  try {
    if (fs.existsSync(newFolderPath)) {
      return res.status(409).json({ error: 'Folder already exists' });
    }
    fs.mkdirSync(newFolderPath, { recursive: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// API: Create File
app.post('/api/create/file', requireAuth, (req, res) => {
  const targetPath = req.body.path; // Parent directory
  let fileName = req.body.name;

  if (!fileName) {
    return res.status(400).json({ error: 'File name is required' });
  }

  if (!fileName.toLowerCase().endsWith('.md')) {
    fileName += '.md';
  }

  const parentDir = targetPath ? path.resolve(DOCS_DIR, targetPath) : DOCS_DIR;
  if (!parentDir.startsWith(DOCS_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const newFilePath = path.join(parentDir, fileName);

  try {
    if (fs.existsSync(newFilePath)) {
      return res.status(409).json({ error: 'File already exists' });
    }
    fs.writeFileSync(newFilePath, '# ' + fileName.replace(/\.md$/i, '') + '\n\n', 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ error: 'Failed to create file' });
  }
});

// API: Rename File or Folder
app.post('/api/rename', requireAuth, (req, res) => {
  const oldPath = req.body.oldPath;
  const newName = req.body.newName;

  if (!oldPath || !newName) {
    return res.status(400).json({ error: 'oldPath and newName are required' });
  }

  // Prevent invalid names
  if (newName.includes('/') || newName.includes('\\')) {
    return res.status(400).json({ error: 'newName cannot contain slashes' });
  }

  const resolvedOldPath = path.resolve(DOCS_DIR, oldPath);
  
  if (resolvedOldPath === DOCS_DIR || !resolvedOldPath.startsWith(DOCS_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  let actualOldPath = resolvedOldPath;
  
  // If the tree API or frontend stripped the extension but the file has it
  if (!fs.existsSync(actualOldPath) && fs.existsSync(actualOldPath + '.md')) {
    actualOldPath += '.md';
  }

  const isMdFile = actualOldPath.toLowerCase().endsWith('.md') && fs.statSync(actualOldPath).isFile();

  if (!fs.existsSync(actualOldPath)) {
    return res.status(404).json({ error: 'Item not found' });
  }

  let actualNewName = newName;
  if (isMdFile && !actualNewName.toLowerCase().endsWith('.md')) {
    actualNewName += '.md';
  }

  const parentDir = path.dirname(actualOldPath);
  const actualNewPath = path.join(parentDir, actualNewName);

  if (fs.existsSync(actualNewPath)) {
    return res.status(409).json({ error: 'Destination already exists' });
  }

  try {
    fs.renameSync(actualOldPath, actualNewPath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error renaming:', error);
    res.status(500).json({ error: 'Failed to rename item' });
  }
});


// API: Delete File or Folder
app.post('/api/delete', requireAuth, (req, res) => {
  const targetPath = req.body.path; // Item to delete

  if (!targetPath) {
    return res.status(400).json({ error: 'Path is required' });
  }

  const resolvedPath = path.resolve(DOCS_DIR, targetPath);
  
  // Prevent deleting the docs root
  if (resolvedPath === DOCS_DIR || !resolvedPath.startsWith(DOCS_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // For files, we expect the frontend to pass the path WITHOUT .md, just like it's used in currentPath
  // But wait, the frontend tree has relPath without .md for files, and exact folder names for folders.
  // If it's a file, we need to try appending .md to find it.
  
  let actualPath = resolvedPath;
  if (!fs.existsSync(actualPath) && fs.existsSync(actualPath + '.md')) {
    actualPath += '.md';
  }

  if (!fs.existsSync(actualPath)) {
    return res.status(404).json({ error: 'Item not found' });
  }

  try {
    const stat = fs.statSync(actualPath);
    if (stat.isDirectory()) {
      fs.rmSync(actualPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(actualPath);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// API: Login
app.post('/api/login', (req, res) => {
  let adminId = 'admin';
  let adminPassword = 'admin';
  
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (settings.adminId) adminId = settings.adminId;
      if (settings.adminPassword) adminPassword = settings.adminPassword;
    } catch (e) {}
  }

  const { id, password } = req.body;
  if (id === adminId && password === adminPassword) {
    currentAuthToken = crypto.randomBytes(32).toString('hex');
    res.json({ success: true, token: currentAuthToken });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// API: Get Settings
app.get('/api/settings', (req, res) => {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      delete settings.adminId;
      delete settings.adminPassword;
      res.json(settings);
    } catch (e) {
      res.json({ primaryColor: '#6750A4', customFont: null, customFontUrl: null });
    }
  } else {
    res.json({ primaryColor: '#6750A4', customFont: null, customFontUrl: null });
  }
});

// API: Save Settings
app.post('/api/settings', requireAuth, (req, res) => {
  const { primaryColor, customFont, customFontUrl, themeMode, siteTitle, faviconUrl, darkModeStart, darkModeEnd, homeDocument } = req.body;
  const settings = { primaryColor, customFont, customFontUrl, themeMode, siteTitle, faviconUrl, darkModeStart, darkModeEnd, homeDocument };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    res.json({ success: true, settings });
  } catch (e) {
    console.error('Error saving settings:', e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// API: Upload Font
app.post('/api/upload/font', requireAuth, upload.single('font'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fontUrl = `/uploads/fonts/${req.file.filename}`;
  res.json({ success: true, url: fontUrl, name: req.file.originalname });
});

// API: Upload Image
app.post('/api/upload/image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = `/uploads/images/${req.file.filename}`;
  res.json({ success: true, url: imageUrl, markdown: `![image](${imageUrl})` });
});

// API: Upload Favicon
app.post('/api/upload/favicon', requireAuth, upload.single('favicon'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const faviconUrl = `/uploads/favicons/${req.file.filename}`;
  res.json({ success: true, url: faviconUrl, name: req.file.originalname });
});

// API: List uploaded fonts
app.get('/api/uploads/fonts', (req, res) => {
  try {
    const files = fs.readdirSync(FONTS_DIR).filter(f => !f.startsWith('.'));
    res.json({ success: true, files: files.map(f => `/uploads/fonts/${f}`) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list fonts' });
  }
});

// API: List uploaded images (for general use)
app.get('/api/uploads/images', (req, res) => {
  try {
    const files = fs.readdirSync(IMAGES_DIR).filter(f => !f.startsWith('.'));
    res.json({ success: true, files: files.map(f => `/uploads/images/${f}`) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// API: List uploaded favicons
app.get('/api/uploads/favicons', (req, res) => {
  try {
    const files = fs.readdirSync(FAVICONS_DIR).filter(f => !f.startsWith('.'));
    res.json({ success: true, files: files.map(f => `/uploads/favicons/${f}`) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list favicons' });
  }
});

app.listen(PORT, () => {
  console.log(`Wiki server running at http://localhost:${PORT}`);
});
