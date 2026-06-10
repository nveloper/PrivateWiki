import { themeFromSourceColor, applyTheme, argbFromHex } from "https://esm.run/@material/material-color-utilities";

document.addEventListener('DOMContentLoaded', () => {
    // Enable KaTeX support in marked.js
    if (typeof markedKatex !== 'undefined') {
        marked.use(markedKatex({ throwOnError: false }));
    }

    const treeContainer = document.getElementById('tree-container');
    const markdownContainer = document.getElementById('markdown-container');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');

    let currentPath = new URLSearchParams(window.location.search).get('path') || '';
    let globalTreeData = [];
    let currentMarkdown = '';
    let authToken = sessionStorage.getItem('authToken') || null;
    let isEditMode = false;

    // Shared Empty State HTML
    const getEmptyStateHtml = () => `
        <h1>Welcome to Wiki</h1>
        <p>Select a document from the left sidebar to start reading.</p>
    `;

    function loadHome(historyMode = 'push') {
        if (currentSettings.homeDocument) {
            currentPath = currentSettings.homeDocument;
            if (historyMode === 'push') window.history.pushState({ path: currentPath }, '', `/?path=${encodeURIComponent(currentPath)}`);
            if (historyMode === 'replace') window.history.replaceState({ path: currentPath }, '', `/?path=${encodeURIComponent(currentPath)}`);
            loadContent(currentPath);
        } else {
            currentPath = '';
            if (historyMode === 'push') window.history.pushState({ path: '' }, '', '/');
            if (historyMode === 'replace') window.history.replaceState({ path: '' }, '', '/');
            markdownContainer.innerHTML = getEmptyStateHtml();
            document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
        }
    }

    // Icon Animation Trigger
    function triggerIconAnim(btnId, animClass) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const icon = btn.querySelector('md-icon');
        if (!icon) return;
        icon.classList.remove(animClass);
        void icon.offsetWidth; // trigger reflow
        icon.classList.add(animClass);
    }

    // Initialize Menu Toggle
    menuToggle.addEventListener('click', () => {
        triggerIconAnim('menu-toggle', 'icon-anim-stretch');
        sidebar.classList.toggle('hidden');
    });

    // Close sidebar and TOC popover when clicking outside
    document.addEventListener('click', (e) => {
        // Sidebar
        if (!sidebar.classList.contains('hidden')) {
             if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                triggerIconAnim('menu-toggle', 'icon-anim-stretch');
                sidebar.classList.add('hidden');
            }
        }

        // TOC Popover
        const mobileTocPopover = document.getElementById('mobile-toc-popover');
        const tocFabBtn = document.getElementById('toc-fab-btn');
        if (mobileTocPopover && !mobileTocPopover.classList.contains('hidden')) {
            if (!mobileTocPopover.contains(e.target) && (!tocFabBtn || !tocFabBtn.contains(e.target))) {
                mobileTocPopover.classList.add('hidden');
            }
        }
    });

    // Handle responsive sidebar on load
    if (window.innerWidth <= 768) {
        sidebar.classList.add('hidden');
    }

    // Load file tree
    async function loadTree() {
        try {
            const response = await fetch('/api/tree', { cache: 'no-store' });
            const treeData = await response.json();
            globalTreeData = treeData;
            treeContainer.innerHTML = ''; // Clear existing
            renderTree(treeData, treeContainer);
            
            if (authToken) {
                const rootAddBtn = document.createElement('div');
                rootAddBtn.className = 'root-add-btn';
                rootAddBtn.innerHTML = `
                    <md-text-button style="width:100%; border-radius: 8px;">
                        <md-icon slot="icon">add</md-icon>
                        New File / Folder
                    </md-text-button>
                `;
                rootAddBtn.querySelector('md-text-button').addEventListener('click', (e) => {
                    const rect = e.target.getBoundingClientRect();
                    lastClickX = rect.left + rect.width / 2;
                    lastClickY = rect.top + rect.height / 2;
                    openCreateDialog('');
                });
                treeContainer.appendChild(rootAddBtn);
            }
        } catch (error) {
            console.error('Failed to load tree:', error);
            treeContainer.innerHTML = '<div style="padding: 16px; color: red;">Failed to load navigation.</div>';
        }
    }

    // Recursively render tree DOM
    function renderTree(items, parentElement, level = 0) {
        items.forEach(item => {
            const nodeDiv = document.createElement('div');
            nodeDiv.className = 'tree-node';

            const itemDiv = document.createElement('div');
            itemDiv.className = 'tree-item';
            // Indentation based on level
            itemDiv.style.paddingLeft = `${16 + (level * 16)}px`;
            
            const iconElement = document.createElement('md-icon');
            const textElement = document.createElement('span');
            textElement.textContent = item.name;

            if (item.type === 'folder') {
                iconElement.textContent = 'folder';
                itemDiv.appendChild(iconElement);
                itemDiv.appendChild(textElement);
                
                const childrenWrapper = document.createElement('div');
                childrenWrapper.className = 'tree-children-wrapper';

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                childrenWrapper.appendChild(childrenContainer);
                
                // Check if we need to open this folder based on currentPath
                const isOpen = currentPath.startsWith(item.path + '/');
                if (isOpen) {
                    childrenWrapper.classList.add('open');
                    iconElement.textContent = 'folder_open';
                }

                itemDiv.addEventListener('click', () => {
                    const isOpening = !childrenWrapper.classList.contains('open');
                    childrenWrapper.classList.toggle('open');
                    iconElement.textContent = isOpening ? 'folder_open' : 'folder';
                });

                nodeDiv.appendChild(itemDiv);
                nodeDiv.appendChild(childrenWrapper);
                renderTree(item.children, childrenContainer, level + 1);

            } else if (item.type === 'file') {
                iconElement.textContent = 'description';
                itemDiv.appendChild(iconElement);
                itemDiv.appendChild(textElement);

                if (currentPath === item.path) {
                    itemDiv.classList.add('active');
                }

                itemDiv.addEventListener('click', () => {
                    // Update active state
                    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
                    itemDiv.classList.add('active');
                    
                    // On mobile, close sidebar after selection
                    if (window.innerWidth <= 768) {
                        sidebar.classList.add('hidden');
                    }

                    loadContent(item.path);
                    
                    // Update URL
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.set('path', item.path);
                    window.history.pushState({ path: item.path }, '', newUrl);
                });

                nodeDiv.appendChild(itemDiv);
            }

            // Append hover actions if logged in
            if (authToken) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'tree-actions';
                
                if (item.type === 'folder') {
                    const addBtn = document.createElement('md-icon-button');
                    addBtn.innerHTML = '<md-icon>add</md-icon>';
                    addBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const rect = e.target.getBoundingClientRect();
                        lastClickX = rect.left + rect.width / 2;
                        lastClickY = rect.top + rect.height / 2;
                        openCreateDialog(item.path);
                    });
                    actionsDiv.appendChild(addBtn);
                }
                
                const renameBtn = document.createElement('md-icon-button');
                renameBtn.innerHTML = '<md-icon>edit</md-icon>';
                renameBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const rect = e.target.getBoundingClientRect();
                    lastClickX = rect.left + rect.width / 2;
                    lastClickY = rect.top + rect.height / 2;
                    openRenameDialog(item.path);
                });
                actionsDiv.appendChild(renameBtn);

                const delBtn = document.createElement('md-icon-button');
                delBtn.innerHTML = '<md-icon>delete</md-icon>';
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const rect = e.target.getBoundingClientRect();
                    lastClickX = rect.left + rect.width / 2;
                    lastClickY = rect.top + rect.height / 2;
                    openDeleteDialog(item.path);
                });
                actionsDiv.appendChild(delBtn);
                itemDiv.appendChild(actionsDiv);
            }

            parentElement.appendChild(nodeDiv);
        });
    }

    // Load and render markdown content
    function processTimeMacros(text) {
        if (!text) return '';
        const now = new Date();

        text = text.replace(/\{\{NOW\}\}/g, () => {
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        });

        const msPerDay = 1000 * 60 * 60 * 24;
        const getDiffDays = (targetDateStr) => {
            const target = new Date(targetDateStr);
            if (isNaN(target.getTime())) return null;
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
            return Math.floor((today - targetMidnight) / msPerDay);
        };

        text = text.replace(/\{\{DDAY:([0-9]{4}-[0-9]{2}-[0-9]{2})\}\}/g, (match, dateStr) => {
            const diff = getDiffDays(dateStr);
            if (diff === null) return match;
            if (diff > 0) return `D+${diff}`;
            if (diff < 0) return `D${diff}`;
            return `D-Day`;
        });

        text = text.replace(/\{\{DAYS_SINCE:([0-9]{4}-[0-9]{2}-[0-9]{2})\}\}/g, (match, dateStr) => {
            const diff = getDiffDays(dateStr);
            return diff !== null ? diff.toString() : match;
        });

        text = text.replace(/\{\{DAYS_UNTIL:([0-9]{4}-[0-9]{2}-[0-9]{2})\}\}/g, (match, dateStr) => {
            const diff = getDiffDays(dateStr);
            return diff !== null ? (-diff).toString() : match;
        });

        return text;
    }

    async function loadContent(path) {
        if (!path) return;
        
        currentPath = path;
        
        // Add loading state
        markdownContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><md-circular-progress indeterminate></md-circular-progress></div>';

        try {
            // Encode the path for the API call to handle spaces and special chars
            const encodedPath = encodeURIComponent(path);
            const response = await fetch(`/api/content?path=${encodedPath}`);
            
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            
            const data = await response.json();
            const markdownText = data.content || data; // Fallback in case old server code hits
            
            // Check for redirect macro: {{REDIRECT:target.md}}
            const redirectMatch = markdownText.match(/\{\{REDIRECT:([^}]+)\}\}/);
            if (redirectMatch) {
                const targetPath = redirectMatch[1].trim();
                if (path !== targetPath) {
                    window.history.replaceState({ path: targetPath }, '', `/?path=${encodeURIComponent(targetPath)}`);
                    return loadContent(targetPath);
                }
            }

            currentMarkdown = markdownText;
            const lastModified = data.lastModified;
            
            // Re-render markdown body to trigger CSS animation
            markdownContainer.classList.remove('markdown-body');
            void markdownContainer.offsetWidth; // trigger reflow
            markdownContainer.classList.add('markdown-body');

            // Build Breadcrumbs
            const parts = path.replace(/\.md$/i, '').split('/');
            
            // 폴더 대표 파일일 경우 (예: US-5A/US-5A.md) 마지막 중복 이름 제거
            if (parts.length > 1 && parts[parts.length - 1] === parts[parts.length - 2]) {
                parts.pop();
            }

            let breadcrumbsHtml = `
                <div class="breadcrumbs" style="font-size: 14px; color: var(--md-sys-color-primary); margin-bottom: 24px; display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                    <span class="breadcrumb-home" style="cursor:pointer; display:flex; align-items:center; opacity:0.8; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">
                        <md-icon style="font-size: 16px; margin-right: 4px;">home</md-icon> Home 
                    </span>
            `;
            let currentFolderPath = '';
            parts.forEach((p, index) => {
                breadcrumbsHtml += `<md-icon style="font-size: 16px; opacity:0.5;">chevron_right</md-icon> `;
                if (index === parts.length - 1) {
                    // Current file (clickable)
                    breadcrumbsHtml += `<span class="breadcrumb-current" style="cursor:pointer; font-weight:500; opacity:0.8; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8" title="Reload ${p}">${p}</span>`;
                } else {
                    currentFolderPath += (currentFolderPath ? '/' : '') + p;
                    // Folder (clickable)
                    breadcrumbsHtml += `<span class="breadcrumb-folder" data-path="${currentFolderPath}/${p}" style="cursor:pointer; opacity:0.7; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Load ${p}.md">${p}</span>`;
                }
            });
            breadcrumbsHtml += `</div>`;

            // Parse markdown to HTML using Marked.js after applying macros
            const processedText = processTimeMacros(markdownText);
            markdownContainer.innerHTML = breadcrumbsHtml + marked.parse(processedText);

            // Wrap tables in responsive divs for mobile horizontal scrolling
            markdownContainer.querySelectorAll('table').forEach(table => {
                const wrapper = document.createElement('div');
                wrapper.style.overflowX = 'auto';
                wrapper.style.maxWidth = '100%';
                wrapper.style.marginBottom = '24px';
                wrapper.style.WebkitOverflowScrolling = 'touch';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
                table.style.marginBottom = '0'; // Remove inner margin
            });

            // SPA routing for internal markdown links
            markdownContainer.querySelectorAll('a').forEach(a => {
                const href = a.getAttribute('href');
                if (href && href.startsWith('/?path=')) {
                    a.addEventListener('click', (e) => {
                        e.preventDefault();
                        const targetPath = new URLSearchParams(href.split('?')[1]).get('path');
                        if (targetPath) {
                            window.history.pushState({ path: targetPath }, '', href);
                            loadContent(targetPath);
                            currentPath = targetPath;
                            loadTree();
                        }
                    });
                }
            });

            // Add click listeners to breadcrumbs
            const homeLink = markdownContainer.querySelector('.breadcrumb-home');
            if (homeLink) {
                homeLink.addEventListener('click', () => {
                    window.location.href = '/';
                });
            }
            
            const currentLink = markdownContainer.querySelector('.breadcrumb-current');
            if (currentLink) {
                currentLink.addEventListener('click', () => {
                    loadContent(path);
                });
            }

            markdownContainer.querySelectorAll('.breadcrumb-folder').forEach(el => {
                el.addEventListener('click', () => {
                    const targetPath = el.getAttribute('data-path') + '.md';
                    window.history.pushState({ path: targetPath }, '', '/?path=' + encodeURIComponent(targetPath));
                    loadContent(targetPath);
                    currentPath = targetPath;
                    loadTree();
                });
            });

            if (typeof buildTOC === 'function') buildTOC();

            if (lastModified) {
                const date = new Date(lastModified);
                const dateStr = date.toLocaleString();
                const footerHtml = `
                    <div style="margin-top: 48px; padding-top: 16px; border-top: 1px dashed var(--md-sys-color-outline-variant); font-size: 13px; color: var(--md-sys-color-on-surface-variant); text-align: right;">
                        Last updated: ${dateStr}
                    </div>
                `;
                markdownContainer.insertAdjacentHTML('beforeend', footerHtml);
            }
            
            // Check auth state
            updateAuthUI();

            // Scroll to top
            document.getElementById('main-content').scrollTop = 0;

        } catch (error) {
            console.error('Failed to load content:', error);
            markdownContainer.innerHTML = `
                <div style="text-align:center; padding: 40px;">
                    <md-icon style="font-size: 48px; color: var(--md-sys-color-error);">error</md-icon>
                    <h2>Document Not Found</h2>
                    <p>The document you are looking for might have been removed or renamed.</p>
                </div>
            `;
        }
    }

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
        const path = new URLSearchParams(window.location.search).get('path');
        if (path) {
            loadContent(path);
            
            // Re-fetch tree to update active state and open folders
            currentPath = path;
            loadTree();
        } else {
            loadHome('none');
            loadTree();
        }
    });

    // Initial Load
    loadSettings();
    loadTree();
    if (currentPath) {
        loadContent(currentPath);
    }

    // Header buttons logic
    const searchBtn = document.getElementById('search-btn');
    const searchDialog = document.getElementById('search-dialog');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const closeSearchBtn = document.getElementById('close-search-btn');

    document.getElementById('app-title').addEventListener('click', () => {
        loadHome('push');
    });

    searchBtn.addEventListener('click', () => {
        triggerIconAnim('search-btn', 'icon-anim-pop');
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchDialog.show();
        setTimeout(() => searchInput.focus(), 100);
    });

    closeSearchBtn.addEventListener('click', () => {
        searchDialog.close();
    });

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (!query) {
            searchResults.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(async () => {
            searchResults.innerHTML = '<div style="padding:16px; text-align:center;">Searching...</div>';
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                
                if (data.length === 0) {
                    searchResults.innerHTML = '<div style="padding:16px; text-align:center;">No results found.</div>';
                    return;
                }

                searchResults.innerHTML = data.map(item => `
                    <div class="search-result-item" data-path="${item.path}" style="padding: 12px; border-radius: 8px; cursor: pointer; transition: background 0.2s;">
                        <div style="font-weight: 500; display:flex; align-items:center; gap:8px;">
                            <md-icon style="font-size:18px;">description</md-icon>
                            ${item.name}
                        </div>
                        <div style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin-top: 4px;">
                            ${item.snippet}
                        </div>
                    </div>
                `).join('');

                // Add hover style and click listeners
                document.querySelectorAll('.search-result-item').forEach(el => {
                    el.addEventListener('mouseover', () => el.style.backgroundColor = 'var(--md-sys-color-surface-container-high)');
                    el.addEventListener('mouseout', () => el.style.backgroundColor = 'transparent');
                    el.addEventListener('click', () => {
                        searchDialog.close();
                        const path = el.getAttribute('data-path');
                        
                        // Navigate
                        currentPath = path;
                        const newUrl = new URL(window.location);
                        newUrl.searchParams.set('path', path);
                        window.history.pushState({ path }, '', newUrl);
                        loadContent(path);
                        loadTree();
                    });
                });
            } catch(e) {
                searchResults.innerHTML = '<div style="padding:16px; text-align:center; color: var(--md-sys-color-error);">Search failed.</div>';
            }
        }, 300);
    });

    document.getElementById('random-btn').addEventListener('click', () => {
        triggerIconAnim('random-btn', 'icon-anim-pop');
        const files = [];
        function extractFiles(items) {
            items.forEach(item => {
                if (item.type === 'file') files.push(item);
                else if (item.type === 'folder' && item.children) extractFiles(item.children);
            });
        }
        extractFiles(globalTreeData);
        
        if (files.length > 0) {
            const randomFile = files[Math.floor(Math.random() * files.length)];
            
            // Update URL and Load content
            currentPath = randomFile.path;
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('path', randomFile.path);
            window.history.pushState({ path: randomFile.path }, '', newUrl);
            
            loadContent(randomFile.path);
            
            // Re-fetch tree to update active state and open folders
            loadTree();
        } else {
            alert('No documents found.');
        }
    });

    // --- Settings and Uploads ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsDialog = document.getElementById('settings-dialog');
    const themeModeSelect = document.getElementById('theme-mode-select');
    const colorPickerTrigger = document.getElementById('color-picker-trigger');
    const colorPaletteMenu = document.getElementById('color-palette-menu');
    const customHexInput = document.getElementById('custom-hex-input');
    const colorChips = document.querySelectorAll('.color-chip');
    const nativeColorPicker = document.getElementById('native-color-picker');
    const colorValue = document.getElementById('color-value');
    const fontSelect = document.getElementById('font-select');
    const fontUploadInput = document.getElementById('font-upload-input');
    const fontUploadStatus = document.getElementById('font-upload-status');
    const faviconSelect = document.getElementById('favicon-select');
    const faviconUploadInput = document.getElementById('favicon-upload-input');
    const faviconUploadStatus = document.getElementById('favicon-upload-status');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    const imageUploadBtn = document.getElementById('image-upload-btn');
    const imageUploadDialog = document.getElementById('image-upload-dialog');
    const imageUploadInput = document.getElementById('image-upload-input');
    const doImageUploadBtn = document.getElementById('do-image-upload-btn');
    const imageResultContainer = document.getElementById('image-result-container');
    const imageMarkdownResult = document.getElementById('image-markdown-result');

    // --- Auth & Edit ---
    const loginBtn = document.getElementById('login-btn');
    const loginDialog = document.getElementById('login-dialog');
    const loginIdInput = document.getElementById('login-id-input');
    const loginPwInput = document.getElementById('login-pw-input');
    const doLoginBtn = document.getElementById('do-login-btn');
    const editBtn = document.getElementById('edit-btn');

    function updateAuthUI() {
        if (authToken) {
            loginBtn.innerHTML = '<md-icon>logout</md-icon>';
            loginBtn.title = 'Logout';
            if (currentPath) {
                editBtn.style.display = 'inline-flex';
            } else {
                editBtn.style.display = 'none';
            }
        } else {
            loginBtn.innerHTML = '<md-icon>account_circle</md-icon>';
            loginBtn.title = 'Admin Login';
            editBtn.style.display = 'none';
            imageUploadBtn.style.display = 'none';
        }
        loadTree(); // Refresh tree to show/hide add/delete icons
    }

    loginBtn.addEventListener('click', () => {
        triggerIconAnim('login-btn', 'icon-anim-pop');
        if (authToken) {
            authToken = null;
            sessionStorage.removeItem('authToken');
            updateAuthUI();
            if (isEditMode) {
                isEditMode = false;
                loadContent(currentPath);
            }
        } else {
            loginIdInput.value = '';
            loginPwInput.value = '';
            loginDialog.show();
        }
    });

    // Trigger login on Enter key
    const triggerLoginOnEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            doLoginBtn.click();
        }
    };
    loginIdInput.addEventListener('keydown', triggerLoginOnEnter);
    loginPwInput.addEventListener('keydown', triggerLoginOnEnter);

    doLoginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: loginIdInput.value, password: loginPwInput.value })
            });
            const data = await res.json();
            if (data.success) {
                authToken = data.token;
                sessionStorage.setItem('authToken', authToken);
                loginDialog.close();
                updateAuthUI();
            } else {
                alert('Login failed: ' + data.error);
            }
        } catch (err) {
            alert('Login error');
        }
    });

    editBtn.addEventListener('click', () => {
        isEditMode = true;
        editBtn.style.display = 'none';
        imageUploadBtn.style.display = 'inline-flex';

        markdownContainer.innerHTML = `
            <div class="edit-actions" style="margin-bottom: 16px; display:flex; justify-content: space-between; align-items: center;">
                <div class="editor-toolbar" style="display:flex; gap: 4px; flex-wrap: wrap;">
                    <md-icon-button class="format-btn" data-format="**" title="Bold"><md-icon>format_bold</md-icon></md-icon-button>
                    <md-icon-button class="format-btn" data-format="*" title="Italic"><md-icon>format_italic</md-icon></md-icon-button>
                    <md-icon-button class="format-btn" data-prefix="## " title="Heading 2"><md-icon>format_h2</md-icon></md-icon-button>
                    <md-icon-button class="format-btn" data-prefix="### " title="Heading 3"><md-icon>format_h3</md-icon></md-icon-button>
                    <md-icon-button class="format-btn" data-format="[link](url)" title="Link"><md-icon>link</md-icon></md-icon-button>
                    <md-icon-button class="format-btn" data-prefix="- " title="List"><md-icon>format_list_bulleted</md-icon></md-icon-button>
                </div>
                <div style="display:flex; gap: 8px;">
                    <md-text-button id="edit-cancel-btn">Cancel</md-text-button>
                    <md-filled-button id="edit-save-btn">Save</md-filled-button>
                </div>
            </div>
            <div class="editor-split-pane">
                <md-outlined-text-field type="textarea" id="edit-textarea" label="Edit Markdown Document" style="width: 100%; height: 70vh; --md-outlined-text-field-container-shape: 12px;">
                </md-outlined-text-field>
                <div id="live-preview-pane" class="markdown-body"></div>
            </div>
        `;
        
        const textarea = document.getElementById('edit-textarea');
        const previewPane = document.getElementById('live-preview-pane');
        textarea.value = currentMarkdown;
        previewPane.innerHTML = marked.parse(currentMarkdown);

        // Live Preview update
        textarea.addEventListener('input', () => {
            previewPane.innerHTML = marked.parse(textarea.value);
        });

        // Toolbar formatting
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.getAttribute('data-format');
                const prefix = btn.getAttribute('data-prefix');
                // The md-outlined-text-field element is a web component, we need its inner textarea
                const innerTextarea = textarea.shadowRoot ? textarea.shadowRoot.querySelector('textarea') : textarea;
                
                let start = textarea.value.length;
                let end = textarea.value.length;
                if (innerTextarea && typeof innerTextarea.selectionStart !== 'undefined') {
                    start = innerTextarea.selectionStart;
                    end = innerTextarea.selectionEnd;
                }

                const val = textarea.value;
                let newVal = val;
                
                if (format) {
                    if (format.includes('link')) {
                        newVal = val.substring(0, start) + '[text](url)' + val.substring(end);
                    } else {
                        const selectedText = val.substring(start, end) || 'text';
                        newVal = val.substring(0, start) + format + selectedText + format + val.substring(end);
                    }
                } else if (prefix) {
                    let lineStart = val.lastIndexOf('\n', start - 1);
                    lineStart = lineStart === -1 ? 0 : lineStart + 1;
                    newVal = val.substring(0, lineStart) + prefix + val.substring(lineStart);
                }

                textarea.value = newVal;
                previewPane.innerHTML = marked.parse(textarea.value);
            });
        });

        document.getElementById('edit-cancel-btn').addEventListener('click', () => {
            isEditMode = false;
            imageUploadBtn.style.display = 'none';
            loadContent(currentPath);
        });

        document.getElementById('edit-save-btn').addEventListener('click', async () => {
            const newContent = document.getElementById('edit-textarea').value;
            try {
                const res = await fetch('/api/content', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + authToken
                    },
                    body: JSON.stringify({ path: currentPath, content: newContent })
                });
                const data = await res.json();
                if (data.success) {
                    isEditMode = false;
                    imageUploadBtn.style.display = 'none';
                    loadContent(currentPath);
                } else {
                    alert('Save failed: ' + data.error);
                }
            } catch (err) {
                alert('Save error');
            }
        });
    });

    let currentSettings = { primaryColor: '#6750A4', customFont: null, customFontUrl: null, themeMode: 'system', siteTitle: 'DB-less Wiki', faviconUrl: null, darkModeStart: '18:00', darkModeEnd: '06:00', homeDocument: '' };
    const siteTitleInput = document.getElementById('site-title-input');
    const homeDocumentInput = document.getElementById('home-document-input');
    const appTitle = document.getElementById('app-title');
    const pageTitle = document.getElementById('page-title');
    const pageFavicon = document.getElementById('page-favicon');

    const imageUploadStatus = document.getElementById('image-upload-status');

    // Update status text when files are selected
    fontUploadInput.addEventListener('change', (e) => {
        fontUploadStatus.textContent = e.target.files.length > 0 ? e.target.files[0].name : 'No file selected';
    });
    faviconUploadInput.addEventListener('change', (e) => {
        faviconUploadStatus.textContent = e.target.files.length > 0 ? e.target.files[0].name : 'No file selected';
    });
    imageUploadInput.addEventListener('change', (e) => {
        imageUploadStatus.textContent = e.target.files.length > 0 ? e.target.files[0].name : 'No file selected';
    });

    function updateTheme() {
        const isDark = getIsDark(currentSettings.themeMode || 'system');
        
        // Apply data-theme for any custom CSS rules we have
        if (currentSettings.themeMode === 'light' || currentSettings.themeMode === 'dark') {
            document.documentElement.setAttribute('data-theme', currentSettings.themeMode);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        // Use material-color-utilities to generate the full tonal palette
        const theme = themeFromSourceColor(argbFromHex(currentSettings.primaryColor || '#6750A4'));
        applyTheme(theme, { target: document.documentElement, dark: isDark });
        
        // Ensure color-scheme is set for native elements (scrollbars, etc)
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    }

    function getIsDark(mode) {
        if (mode === 'dark') return true;
        if (mode === 'light') return false;
        if (mode === 'schedule') {
            const start = currentSettings.darkModeStart || '18:00';
            const end = currentSettings.darkModeEnd || '06:00';
            const now = new Date();
            const currentMins = now.getHours() * 60 + now.getMinutes();
            const parseTime = (t) => {
                const parts = t.split(':');
                return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            };
            const startMins = parseTime(start);
            const endMins = parseTime(end);
            
            if (startMins <= endMins) {
                return currentMins >= startMins && currentMins < endMins;
            } else {
                return currentMins >= startMins || currentMins < endMins;
            }
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Re-evaluate theme every 1 minute
    setInterval(() => {
        if (currentSettings.themeMode === 'schedule' || currentSettings.themeMode === 'system') {
            updateTheme();
        }
    }, 60000);

    // Listen for OS theme changes if in system mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (!currentSettings.themeMode || currentSettings.themeMode === 'system') {
            updateTheme();
        }
    });

    themeModeSelect.addEventListener('change', (e) => {
        currentSettings.themeMode = e.target.value;
        const scheduleGroup = document.getElementById('theme-schedule-group');
        if (scheduleGroup) {
            scheduleGroup.style.display = e.target.value === 'schedule' ? 'flex' : 'none';
        }
        updateTheme();
    });

    // Custom Color Picker Logic
    colorPickerTrigger.addEventListener('click', () => {
        customHexInput.value = currentSettings.primaryColor || '#6750A4';
        colorPaletteMenu.open = true;
    });

    function applyColorSelection(hexColor) {
        colorValue.textContent = hexColor;
        currentSettings.primaryColor = hexColor;
        document.getElementById('color-picker-preview').style.backgroundColor = hexColor;
        updateTheme();
    }

    colorChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            const hexColor = e.target.getAttribute('data-color');
            customHexInput.value = hexColor;
            applyColorSelection(hexColor);
            colorPaletteMenu.open = false;
        });
    });

    nativeColorPicker.addEventListener('input', (e) => {
        const hex = e.target.value;
        customHexInput.value = hex;
        applyColorSelection(hex);
    });

    customHexInput.addEventListener('input', (e) => {
        const hex = e.target.value;
        if (/^#[0-9A-F]{6}$/i.test(hex)) {
            applyColorSelection(hex);
        }
    });

    settingsBtn.addEventListener('click', async () => {
        triggerIconAnim('settings-btn', 'icon-anim-gear');
        const currentColor = currentSettings.primaryColor || '#6750A4';
        colorValue.textContent = currentColor;
        document.getElementById('color-picker-preview').style.backgroundColor = currentColor;
        customHexInput.value = currentColor;
        themeModeSelect.value = currentSettings.themeMode || 'system';
        const scheduleGroup = document.getElementById('theme-schedule-group');
        if (scheduleGroup) {
            scheduleGroup.style.display = themeModeSelect.value === 'schedule' ? 'flex' : 'none';
        }
        document.getElementById('dark-mode-start').value = currentSettings.darkModeStart || '18:00';
        document.getElementById('dark-mode-end').value = currentSettings.darkModeEnd || '06:00';
        siteTitleInput.value = currentSettings.siteTitle || 'DB-less Wiki';
        if (homeDocumentInput) homeDocumentInput.value = currentSettings.homeDocument || '';
        fontUploadInput.value = '';
        fontUploadStatus.textContent = 'No file selected';
        if (typeof faviconUploadInput !== 'undefined') {
            faviconUploadInput.value = '';
            if(faviconUploadStatus) faviconUploadStatus.textContent = 'No file selected';
        }

        try {
            const resFonts = await fetch('/api/uploads/fonts');
            if (resFonts.ok) {
                const data = await resFonts.json();
                let html = '<md-select-option value=""><div slot="headline">Default System Font</div></md-select-option>';
                data.files.forEach(f => {
                    const name = f.split('/').pop();
                    const selected = (currentSettings.customFontUrl === f) ? 'selected' : '';
                    html += `<md-select-option value="${f}" ${selected}><div slot="headline">${name}</div></md-select-option>`;
                });
                const oldFontSelect = document.getElementById('font-select');
                if (oldFontSelect) {
                    const newFontSelect = document.createElement('md-outlined-select');
                    newFontSelect.id = 'font-select';
                    newFontSelect.setAttribute('label', 'Choose Font');
                    newFontSelect.innerHTML = html;
                    oldFontSelect.replaceWith(newFontSelect);
                    
                    // Inject blur effect into shadow root for the menu
                    setTimeout(() => {
                        if (newFontSelect.shadowRoot) {
                            const menu = newFontSelect.shadowRoot.querySelector('md-menu');
                            if (menu && menu.shadowRoot) {
                                const sheet = new CSSStyleSheet();
                                sheet.replaceSync('* { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }');
                                menu.shadowRoot.adoptedStyleSheets = [...menu.shadowRoot.adoptedStyleSheets, sheet];
                            }
                        }
                    }, 50);
                }
            }
            const resImages = await fetch('/api/uploads/favicons');
            if (resImages.ok) {
                const data = await resImages.json();
                let html = '<md-select-option value=""><div slot="headline">Default (None)</div></md-select-option>';
                data.files.forEach(f => {
                    const name = f.split('/').pop();
                    const selected = (currentSettings.faviconUrl === f) ? 'selected' : '';
                    html += `<md-select-option value="${f}" ${selected}><div slot="headline">${name}</div></md-select-option>`;
                });
                const oldFaviconSelect = document.getElementById('favicon-select');
                if (oldFaviconSelect) {
                    const newFaviconSelect = document.createElement('md-outlined-select');
                    newFaviconSelect.id = 'favicon-select';
                    newFaviconSelect.setAttribute('label', 'Choose Favicon');
                    newFaviconSelect.innerHTML = html;
                    oldFaviconSelect.replaceWith(newFaviconSelect);

                    // Inject blur effect into shadow root for the menu
                    setTimeout(() => {
                        if (newFaviconSelect.shadowRoot) {
                            const menu = newFaviconSelect.shadowRoot.querySelector('md-menu');
                            if (menu && menu.shadowRoot) {
                                const sheet = new CSSStyleSheet();
                                sheet.replaceSync('* { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }');
                                menu.shadowRoot.adoptedStyleSheets = [...menu.shadowRoot.adoptedStyleSheets, sheet];
                            }
                        }
                    }, 50);
                }
            }
        } catch(e) {}

        settingsDialog.show();
    });

    imageUploadBtn.addEventListener('click', () => {
        imageUploadInput.value = '';
        imageUploadStatus.textContent = 'No file selected';
        imageResultContainer.style.display = 'none';
        imageMarkdownResult.value = '';
        doImageUploadBtn.innerHTML = 'Upload';
        doImageUploadBtn.dataset.state = 'upload';
        imageUploadDialog.show();
    });

    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            currentSettings = Object.assign(currentSettings, await res.json());
            localStorage.setItem('siteConfig', JSON.stringify(currentSettings));
            if (currentSettings.customFontUrl) applyFont(currentSettings.customFont, currentSettings.customFontUrl);
            applySiteTitle(currentSettings.siteTitle);
            applyFavicon(currentSettings.faviconUrl);
            updateTheme();
        } catch (e) {
            console.error('Failed to load settings', e);
            updateTheme(); // apply defaults
        }
    }

    function applySiteTitle(title) {
        const t = title || 'DB-less Wiki';
        appTitle.textContent = t;
        pageTitle.textContent = t;
    }

    function applyFavicon(url) {
        const appleIcon = document.getElementById('page-apple-icon');
        if (url) {
            pageFavicon.href = url;
            if (appleIcon) appleIcon.href = url;
        } else {
            pageFavicon.removeAttribute('href');
            if (appleIcon) appleIcon.removeAttribute('href');
        }
    }

    function applyFont(fontName, fontUrl) {
        if (!fontUrl) return;
        const newStyle = document.createElement('style');
        newStyle.appendChild(document.createTextNode(`
            @font-face {
                font-family: '${fontName}';
                src: url('${fontUrl}');
            }
            :root {
                --md-ref-typeface-brand: '${fontName}', 'Roboto', system-ui, sans-serif !important;
                --md-ref-typeface-plain: '${fontName}', 'Roboto', system-ui, sans-serif !important;
            }
            * {
                font-family: '${fontName}', 'Roboto', system-ui, sans-serif;
            }
            md-icon, .material-symbols-outlined {
                font-family: 'Material Symbols Outlined' !important;
            }
        `));
        document.head.appendChild(newStyle);
    }

    saveSettingsBtn.addEventListener('click', async () => {
        currentSettings.primaryColor = customHexInput.value;
        currentSettings.themeMode = themeModeSelect.value;
        currentSettings.darkModeStart = document.getElementById('dark-mode-start').value || '18:00';
        currentSettings.darkModeEnd = document.getElementById('dark-mode-end').value || '06:00';
        currentSettings.siteTitle = siteTitleInput.value || 'DB-less Wiki';
        if (homeDocumentInput) currentSettings.homeDocument = homeDocumentInput.value || '';
        applySiteTitle(currentSettings.siteTitle);
        updateTheme();

        // Upload font if selected
        if (fontUploadInput.files.length > 0) {
            const file = fontUploadInput.files[0];
            const formData = new FormData();
            formData.append('font', file);
            
            fontUploadStatus.textContent = 'Uploading font...';
            try {
                const res = await fetch('/api/upload/font', { 
                    method: 'POST', 
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    body: formData 
                });
                if (res.status === 401) {
                    alert('Session expired. Please log in again.');
                    return;
                }
                const data = await res.json();
                if (res.ok && data.success) {
                    currentSettings.customFontUrl = data.url;
                    currentSettings.customFont = 'CustomFont_' + Date.now();
                    applyFont(currentSettings.customFont, currentSettings.customFontUrl);
                    fontUploadStatus.textContent = 'Font uploaded successfully!';
                } else {
                    fontUploadStatus.textContent = 'Upload failed: ' + (data.error || '');
                }
            } catch (e) {
                fontUploadStatus.textContent = 'Upload failed.';
            }
        } else {
            const currentFontSelect = document.getElementById('font-select');
            currentSettings.customFontUrl = currentFontSelect ? currentFontSelect.value : null;
            if (currentSettings.customFontUrl) {
                currentSettings.customFont = 'CustomFont_' + currentSettings.customFontUrl.split('/').pop().replace(/\W/g, '');
                applyFont(currentSettings.customFont, currentSettings.customFontUrl);
            } else {
                currentSettings.customFont = null;
            }
        }

        // Upload favicon if selected
        if (faviconUploadInput.files.length > 0) {
            const formData = new FormData();
            formData.append('favicon', faviconUploadInput.files[0]);
            
            faviconUploadStatus.textContent = 'Uploading favicon...';
            try {
                const res = await fetch('/api/upload/favicon', { 
                    method: 'POST', 
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    body: formData 
                });
                if (res.status === 401) {
                    alert('Session expired. Please log in again.');
                    return;
                }
                const data = await res.json();
                if (res.ok && data.success) {
                    currentSettings.faviconUrl = data.url;
                    applyFavicon(data.url);
                    faviconUploadStatus.textContent = 'Uploaded successfully!';
                } else {
                    faviconUploadStatus.textContent = 'Upload failed: ' + (data.error || '');
                }
            } catch (e) {
                faviconUploadStatus.textContent = 'Upload failed.';
            }
        } else {
            const currentFaviconSelect = document.getElementById('favicon-select');
            currentSettings.faviconUrl = currentFaviconSelect ? currentFaviconSelect.value : null;
            applyFavicon(currentSettings.faviconUrl || '');
        }

        // Save settings to server and local storage
        try {
            localStorage.setItem('siteConfig', JSON.stringify(currentSettings));
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify(currentSettings)
            });
            if (res.status === 401) {
                alert('Session expired. Please log in again to save settings.');
                return;
            }
            if (res.ok) {
                settingsDialog.close();
            } else {
                const data = await res.json();
                alert('Failed to save settings: ' + data.error);
            }
        } catch (e) {
            console.error('Failed to save settings', e);
            alert('Failed to save settings.');
        }
    });

    doImageUploadBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        if (doImageUploadBtn.dataset.state === 'ok') {
            await playCloseAnim(imageUploadDialog);
            imageUploadDialog.close();
            return;
        }

        if (imageUploadInput.files.length === 0) return;
        
        const file = imageUploadInput.files[0];
        const formData = new FormData();
        formData.append('image', file);

        doImageUploadBtn.disabled = true;
        try {
            const res = await fetch('/api/upload/image', { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData 
            });
            const data = await res.json();
            if (data.success) {
                imageResultContainer.style.display = 'block';
                imageMarkdownResult.value = data.markdown;

                try {
                    await navigator.clipboard.writeText(data.markdown);
                    alert('경로가 클립보드에 복사되었습니다.');
                } catch(e) {}

                doImageUploadBtn.innerHTML = 'OK';
                doImageUploadBtn.dataset.state = 'ok';
            }
        } catch (err) {
            alert('Image upload failed.');
        } finally {
            doImageUploadBtn.disabled = false;
        }
    });

    imageMarkdownResult.addEventListener('click', () => {
        imageMarkdownResult.select();
        navigator.clipboard.writeText(imageMarkdownResult.value)
            .then(() => alert('Copied to clipboard!'));
    });

    // --- File/Folder Management Logic ---
    let currentActionPath = '';
    const createItemDialog = document.getElementById('create-item-dialog');
    const createItemForm = document.getElementById('create-item-form');
    const createNameInput = document.getElementById('create-item-name-input');
    const createTypeToggle = document.getElementById('create-type-toggle');

    const deleteConfirmDialog = document.getElementById('delete-confirm-dialog');
    const deleteConfirmForm = document.getElementById('delete-confirm-form');
    const deleteConfirmText = document.getElementById('delete-confirm-text');

    function openCreateDialog(targetPath) {
        currentActionPath = targetPath;
        createNameInput.value = '';
        createItemDialog.show();
    }

    function openDeleteDialog(targetPath) {
        currentActionPath = targetPath;
        deleteConfirmText.textContent = `Are you sure you want to delete "${targetPath.split('/').pop()}"?`;
        deleteConfirmDialog.show();
    }

    const renameItemDialog = document.getElementById('rename-item-dialog');
    const renameItemForm = document.getElementById('rename-item-form');
    const renameItemInput = document.getElementById('rename-item-input');

    function openRenameDialog(targetPath) {
        currentActionPath = targetPath;
        renameItemInput.value = targetPath.split('/').pop().replace(/\.md$/i, '');
        renameItemDialog.show();
    }

    renameItemForm.addEventListener('submit', async (e) => {
        if (e.submitter && e.submitter.id === 'do-rename-btn') {
            e.preventDefault();
            const newName = renameItemInput.value.trim();
            if (!newName) return alert('Name required');

            try {
                const res = await fetch('/api/rename', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                    body: JSON.stringify({ oldPath: currentActionPath, newName })
                });

                if (res.status === 401) return alert('Session expired.');

                const data = await res.json();
                if (res.ok && data.success) {
                    await playCloseAnim(renameItemDialog);
                    renameItemDialog.close();
                    
                    // If current viewed path was renamed or was inside the renamed folder
                    if (currentPath === currentActionPath || currentPath.startsWith(currentActionPath + '/')) {
                        currentPath = '';
                        window.history.pushState({ path: '' }, '', '/');
                        markdownContainer.innerHTML = '<h1>Document renamed</h1><p>Please select it again from the sidebar.</p>';
                    }
                    
                    loadTree();
                } else {
                    alert('Error: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Request failed: ' + err.message);
            }
        }
    });

    createItemForm.addEventListener('submit', async (e) => {
        // Only handle our custom Create button click, let Cancel natively close
        if (e.submitter && e.submitter.id === 'do-create-item-btn') {
            e.preventDefault();
            const name = createNameInput.value.trim();
            if (!name) return alert('Name required');
            
            const typeRadio = document.querySelector('input[name="item-type"]:checked');
            const type = typeRadio ? typeRadio.value : 'folder';
            
            const apiPath = type === 'folder' ? '/api/create/folder' : '/api/create/file';
            
            try {
                const res = await fetch(apiPath, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                    body: JSON.stringify({ path: currentActionPath, name })
                });
                
                if (res.status === 401) {
                    alert('Session expired. Please log in again.');
                    return;
                }
                
                if (!res.ok) {
                    const text = await res.text();
                    try {
                        const json = JSON.parse(text);
                        alert('Error: ' + json.error);
                    } catch(e) {
                        alert('Server error: ' + text.substring(0, 50));
                    }
                    return;
                }
                
                const data = await res.json();
                if (data.success) {
                    await playCloseAnim(createItemDialog);
                    createItemDialog.close();
                    loadTree();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch(err) {
                alert('Request failed: ' + err.message);
            }
        }
    });

    deleteConfirmForm.addEventListener('submit', async (e) => {
        if (e.submitter && e.submitter.id === 'do-delete-btn') {
            e.preventDefault();
            try {
                const res = await fetch('/api/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                    body: JSON.stringify({ path: currentActionPath })
                });
                
                if (res.status === 401) {
                    alert('Session expired. Please log in again.');
                    return;
                }

                if (!res.ok) {
                    const text = await res.text();
                    try {
                        const json = JSON.parse(text);
                        alert('Error: ' + json.error);
                    } catch(e) {
                        alert('Server error: ' + text.substring(0, 50));
                    }
                    return;
                }

                const data = await res.json();
                if (data.success) {
                    await playCloseAnim(deleteConfirmDialog);
                    deleteConfirmDialog.close();
                    
                    if (currentPath === currentActionPath || currentPath.startsWith(currentActionPath + '/')) {
                        currentPath = '';
                        window.history.pushState({ path: '' }, '', '/');
                        document.getElementById('app-title').click();
                    } else {
                        loadTree();
                    }
                } else {
                    alert('Error: ' + data.error);
                }
            } catch(err) {
                alert('Request failed: ' + err.message);
            }
        }
    });

    // Record last clicked coordinate for dialog pop origin
    let lastClickX = 0;
    let lastClickY = 0;
    document.addEventListener('click', (e) => {
        if (e.target.closest('md-icon-button') || e.target.closest('md-filled-tonal-button')) {
            const rect = e.target.closest('md-icon-button, md-filled-tonal-button').getBoundingClientRect();
            lastClickX = rect.left + rect.width / 2;
            lastClickY = rect.top + rect.height / 2;
        }
    }, { capture: true });

    // Inject Blur styling into MD3 Dialogs and Menus
    document.querySelectorAll('md-dialog, md-menu, md-outlined-select').forEach(el => {
        customElements.whenDefined(el.localName).then(() => {
            if (el.shadowRoot) {
                const style = document.createElement('style');
                style.textContent = `
                    .dialog, dialog, .menu, md-menu {
                        backdrop-filter: blur(10px) !important;
                        -webkit-backdrop-filter: blur(10px) !important;
                        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.25) !important;
                    }
                    .scrim {
                        display: none !important;
                    }
                    ::-webkit-scrollbar {
                        display: none !important;
                    }
                    * {
                        scrollbar-width: none !important;
                        -ms-overflow-style: none !important;
                    }
                `;
                el.shadowRoot.appendChild(style);

                // Handle nested md-menu inside md-outlined-select
                if (el.localName.includes('select')) {
                    const injectNested = () => {
                        const internalMenu = el.shadowRoot.querySelector('md-menu');
                        if (internalMenu && internalMenu.shadowRoot) {
                            const style2 = document.createElement('style');
                            style2.textContent = `
                                .menu, .surface, .container {
                                    backdrop-filter: blur(10px) !important;
                                    -webkit-backdrop-filter: blur(10px) !important;
                                    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.25) !important;
                                }
                            `;
                            internalMenu.shadowRoot.appendChild(style2);
                        } else if (internalMenu) {
                            setTimeout(injectNested, 50); // Wait for shadow root attachment
                        }
                    };
                    injectNested();
                }
            }
        });
    });

    // Custom Mobile-App Style Pop Animations for Dialogs (Intercepts the 'quick' instant open)
    document.querySelectorAll('md-dialog').forEach(mdDialog => {
        // Override the close method to inject our animation
        const originalClose = mdDialog.close.bind(mdDialog);
        mdDialog.close = async function(returnValue) {
            if (this.open && !this._isClosing) {
                this._isClosing = true;
                await playCloseAnim(this);
                originalClose(returnValue);
                this._isClosing = false;
            } else if (!this.open && !this._isClosing) {
                originalClose(returnValue);
            }
        };
        mdDialog.addEventListener('open', () => {
            const nativeDialog = mdDialog.shadowRoot.querySelector('.dialog') || mdDialog.shadowRoot.querySelector('dialog');
            
            if (nativeDialog) {
                try { nativeDialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out', pseudoElement: '::backdrop' }); } catch (e) {}
                
                // Hide instantly to prevent a 1-frame center flash before layout completes
                nativeDialog.style.opacity = '0';
                
                requestAnimationFrame(() => {
                    const rect = nativeDialog.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const tx = (lastClickX || cx) - cx;
                    const ty = (lastClickY || cy) - cy;

                    const anim = nativeDialog.animate([
                        { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 },
                        { transform: 'translate(0, 0) scale(1)', opacity: 1 }
                    ], { 
                        duration: 300, 
                        easing: 'cubic-bezier(0.0, 0.0, 0.2, 1)' // Smooth decel, no bounce
                    });
                    
                    anim.onfinish = () => { nativeDialog.style.opacity = ''; };
                });
            }
        });

        // Intercept cancel event (Escape key or scrim click)
        mdDialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            mdDialog.close(); // Triggers our overridden close with animation
        });
    });

    async function playCloseAnim(mdDialog) {
        const nativeDialog = mdDialog.shadowRoot.querySelector('.dialog') || mdDialog.shadowRoot.querySelector('dialog');
        const scrim = mdDialog.shadowRoot.querySelector('.scrim');
        let animFinished = Promise.resolve();

        if (scrim) {
            const currentOpacity = getComputedStyle(scrim).opacity || 0.32;
            scrim.animate([{ opacity: currentOpacity }, { opacity: 0 }], { duration: 250, easing: 'ease-in' });
        }
        
        if (nativeDialog) {
            try { nativeDialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease-in', pseudoElement: '::backdrop' }); } catch (e) {}

            const rect = nativeDialog.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const tx = (lastClickX || cx) - cx;
            const ty = (lastClickY || cy) - cy;

            const anim = nativeDialog.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
            ], { 
                duration: 250, 
                easing: 'cubic-bezier(0.2, 0, 0, 1)' 
            });
            animFinished = anim.finished;
        }
        await animFinished;
    }

    // Note: form[method="dialog"] submissions are now handled naturally because 
    // MWC md-dialog internally calls .close(), which we have overridden above.

    // Scroll to Top and Pill FAB Logic
    const pillFabContainer = document.querySelector('.pill-fab-container');
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
    const mainContentArea = document.getElementById('main-content');
    const tocFabBtn = document.getElementById('toc-fab-btn');
    const mobileTocPopover = document.getElementById('mobile-toc-popover');
    const mobileTocContent = document.getElementById('mobile-toc-content');
    const closeMobileTocBtn = document.getElementById('close-mobile-toc-btn');

    if (pillFabContainer && mainContentArea) {
        mainContentArea.addEventListener('scroll', () => {
            if (mainContentArea.scrollTop > 10) {
                pillFabContainer.classList.remove('hidden');
            } else {
                pillFabContainer.classList.add('hidden');
            }
        });

        if (scrollToTopBtn) {
            scrollToTopBtn.addEventListener('click', () => {
                mainContentArea.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    if (tocFabBtn && mobileTocPopover) {
        tocFabBtn.addEventListener('click', () => {
            mobileTocPopover.classList.toggle('hidden');
        });
        
        if (closeMobileTocBtn) {
            closeMobileTocBtn.addEventListener('click', () => {
                mobileTocPopover.classList.add('hidden');
            });
        }
    }

    // TOC Builder
    window.buildTOC = function() {
        const headings = Array.from(markdownContainer.querySelectorAll('h2, h3'));
        
        if (headings.length === 0) {
            if (tocFabBtn) tocFabBtn.style.display = 'none';
            return;
        }

        if (tocFabBtn) tocFabBtn.style.display = 'flex';
        
        let tocHtml = '<div class="toc-heading">Table of Contents</div>';
        
        headings.forEach((h, index) => {
            // Assign IDs to headings if they don't have one
            if (!h.id) {
                h.id = 'heading-' + index;
            }
            const levelClass = h.tagName.toLowerCase() === 'h2' ? 'toc-h2' : 'toc-h3';
            tocHtml += `<a href="#${h.id}" class="toc-link ${levelClass}" title="${h.textContent}">${h.textContent}</a>`;
        });
        
        if (mobileTocContent) mobileTocContent.innerHTML = tocHtml;

        // Add smooth scroll for TOC links
        document.querySelectorAll('.toc-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    mainContentArea.scrollTo({
                        top: targetEl.offsetTop - 20,
                        behavior: 'smooth'
                    });
                    if (mobileTocPopover) {
                        mobileTocPopover.classList.add('hidden');
                    }
                }
            });
        });
    };

    // Initial Load
    async function init() {
        updateAuthUI();
        await loadSettings();
        await loadTree();

        if (currentPath) {
            loadContent(currentPath);
        } else {
            loadHome('replace');
        }
    }
    
    init();
});
