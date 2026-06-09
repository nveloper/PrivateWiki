const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs');

function buildTree(dirPath) {
    const items = [];
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        const relPath = path.relative(docsDir, fullPath).replace(/\\/g, '/');

        if (stat.isDirectory()) {
            items.push({
                type: 'folder',
                name: file,
                path: relPath,
                children: buildTree(fullPath)
            });
        } else if (file.toLowerCase().endsWith('.md')) {
            items.push({
                type: 'file',
                name: file,
                path: relPath
            });
        }
    }

    // Sort: folders first, then files alphabetically
    items.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    return items;
}

function buildSearchIndex(dirPath) {
    let index = [];
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        const relPath = path.relative(docsDir, fullPath).replace(/\\/g, '/');

        if (stat.isDirectory()) {
            index = index.concat(buildSearchIndex(fullPath));
        } else if (file.toLowerCase().endsWith('.md')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            index.push({
                name: file,
                path: relPath,
                content: content
            });
        }
    }
    return index;
}

function run() {
    console.log('Building GitHub Pages static assets...');
    
    if (!fs.existsSync(docsDir)) {
        console.error('Error: docs directory not found at', docsDir);
        process.exit(1);
    }
    
    // 1. Build tree.json
    const tree = buildTree(docsDir);
    fs.writeFileSync(path.join(__dirname, 'tree.json'), JSON.stringify(tree, null, 2));
    console.log('Generated tree.json');

    // 2. Build search_index.json
    const searchIndex = buildSearchIndex(docsDir);
    fs.writeFileSync(path.join(__dirname, 'search_index.json'), JSON.stringify(searchIndex, null, 2));
    console.log('Generated search_index.json');
    
    console.log('Build complete.');
}

run();
