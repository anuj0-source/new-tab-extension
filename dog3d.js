/* ======================================================
   DOG3D.JS - Problem Tracker panel renderer
   ====================================================== */
(function () {
    'use strict';

    const savedListEl = document.getElementById('problem-list');
    const savedEmptyEl = document.getElementById('problem-empty');
    const revisionListEl = document.getElementById('revision-list');
    const revisionEmptyEl = document.getElementById('revision-empty');

    const savedCountEl = document.getElementById('problem-saved-count');
    const revisionCountEl = document.getElementById('problem-revision-count');
    const tabSavedCountEl = document.getElementById('problem-tab-saved-count');
    const tabRevisionCountEl = document.getElementById('problem-tab-revision-count');

    const tabSavedBtn = document.getElementById('problem-tab-saved');
    const tabRevisionBtn = document.getElementById('problem-tab-revision');
    const savedSectionEl = document.getElementById('saved-section');
    const revisionSectionEl = document.getElementById('revision-section');

    const connectBtn = document.getElementById('problem-connect-btn');
    const statusDot = document.getElementById('problem-sync-dot');
    const statusText = document.getElementById('problem-sync-text');

    if (
        !savedListEl || !savedEmptyEl || !revisionListEl || !revisionEmptyEl ||
        !savedCountEl || !revisionCountEl || !tabSavedCountEl || !tabRevisionCountEl ||
        !tabSavedBtn || !tabRevisionBtn || !savedSectionEl || !revisionSectionEl ||
        !connectBtn || !statusDot || !statusText
    ) return;

    const STORAGE_KEYS = ['myQuestions', 'revisionList'];
    const MAX_VISIBLE = 30;
    const ACTIVE_TAB_KEY = 'problemTrackerActiveTab';
    const EXTENSION_ID_CACHE_KEY = 'problemTrackerExtensionId';

    let loading = false;
    let realtimeRegisteredExtensionId = null;

    function hasChromeRuntime() {
        return typeof chrome !== 'undefined' && chrome.runtime;
    }

    function hasChromeStorage() {
        return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    }

    function hasManagementApi() {
        return typeof chrome !== 'undefined' && chrome.management && typeof chrome.management.getAll === 'function';
    }

    function isValidExtensionId(value) {
        return typeof value === 'string' && /^[a-p]{32}$/.test(value);
    }

    function safeParseArray(value) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_err) {
            return [];
        }
    }

    function normalizeCollections(raw) {
        return {
            myQuestions: Array.isArray(raw && raw.myQuestions) ? raw.myQuestions : [],
            revisionList: Array.isArray(raw && raw.revisionList) ? raw.revisionList : []
        };
    }

    function mergeCollections(collectionsList) {
        const merged = { myQuestions: [], revisionList: [] };

        for (let i = 0; i < collectionsList.length; i += 1) {
            const part = normalizeCollections(collectionsList[i]);
            merged.myQuestions = merged.myQuestions.concat(part.myQuestions);
            merged.revisionList = merged.revisionList.concat(part.revisionList);
        }

        return merged;
    }

    function setStatus(state, label) {
        statusText.textContent = label;
        statusDot.className = 'pet-status-dot';

        if (state === 'ok') {
            statusDot.classList.add('happy');
        } else if (state === 'error') {
            statusDot.classList.add('sleeping');
        }
    }

    function setActiveTab(tabName) {
        const resolved = tabName === 'revision' ? 'revision' : 'saved';
        const isSavedActive = resolved === 'saved';

        savedSectionEl.classList.toggle('hidden', !isSavedActive);
        revisionSectionEl.classList.toggle('hidden', isSavedActive);

        tabSavedBtn.classList.toggle('active', isSavedActive);
        tabRevisionBtn.classList.toggle('active', !isSavedActive);

        tabSavedBtn.setAttribute('aria-selected', isSavedActive ? 'true' : 'false');
        tabRevisionBtn.setAttribute('aria-selected', isSavedActive ? 'false' : 'true');

        localStorage.setItem(ACTIVE_TAB_KEY, resolved);
    }

    function getSavedActiveTab() {
        const saved = localStorage.getItem(ACTIVE_TAB_KEY);
        return saved === 'revision' ? 'revision' : 'saved';
    }

    function readFromLocalStorage() {
        return {
            myQuestions: safeParseArray(localStorage.getItem('myQuestions')),
            revisionList: safeParseArray(localStorage.getItem('revisionList'))
        };
    }

    function readFromCurrentExtensionStorage() {
        return new Promise((resolve) => {
            if (!hasChromeStorage()) {
                resolve({ myQuestions: [], revisionList: [] });
                return;
            }

            try {
                chrome.storage.local.get(STORAGE_KEYS, (stored) => {
                    resolve(normalizeCollections(stored || {}));
                });
            } catch (_err) {
                resolve({ myQuestions: [], revisionList: [] });
            }
        });
    }

    function discoverCandidateExtensionIds() {
        return new Promise((resolve) => {
            if (!hasManagementApi()) {
                resolve([]);
                return;
            }

            try {
                chrome.management.getAll((items) => {
                    if (chrome.runtime && chrome.runtime.lastError) {
                        resolve([]);
                        return;
                    }

                    const all = (items || []).filter((item) => {
                        return !!item && item.enabled && item.type === 'extension' && item.id !== chrome.runtime.id;
                    });

                    const preferred = all
                        .filter((item) => /problem\s*tracker/i.test(item.name || ''))
                        .map((item) => item.id);

                    const others = all.map((item) => item.id).filter((id) => preferred.indexOf(id) === -1);
                    resolve(preferred.concat(others));
                });
            } catch (_err) {
                resolve([]);
            }
        });
    }

    function sendMessageToExtension(extensionId, message) {
        return new Promise((resolve, reject) => {
            if (!hasChromeRuntime()) {
                reject(new Error('Chrome runtime unavailable'));
                return;
            }

            if (!isValidExtensionId(extensionId)) {
                reject(new Error('Missing extension id'));
                return;
            }

            let done = false;
            const timeout = setTimeout(() => {
                if (done) return;
                done = true;
                reject(new Error('Message timeout'));
            }, 1800);

            try {
                chrome.runtime.sendMessage(extensionId, message, (response) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);

                    if (chrome.runtime && chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message || 'Message failed'));
                        return;
                    }

                    resolve(response);
                });
            } catch (err) {
                if (done) return;
                done = true;
                clearTimeout(timeout);
                reject(err);
            }
        });
    }

    function setConnectState(isConnected) {
        connectBtn.classList.toggle('connected', !!isConnected);
        connectBtn.textContent = isConnected ? 'connected' : 'connect';
        connectBtn.title = isConnected
            ? 'Connected to Problem Tracker extension'
            : 'Connect Problem Tracker extension';
    }

    async function registerRealtimeUpdates(extensionId) {
        if (!isValidExtensionId(extensionId)) return false;
        if (realtimeRegisteredExtensionId === extensionId) return true;
        if (!hasChromeRuntime()) return false;

        try {
            const response = await sendMessageToExtension(extensionId, {
                type: 'PT_REGISTER_DASHBOARD',
                dashboardId: chrome.runtime.id
            });

            if (response && response.ok) {
                realtimeRegisteredExtensionId = extensionId;
                return true;
            }
        } catch (_err) {
            // ignore registration failures
        }

        return false;
    }

    async function unregisterRealtimeUpdates() {
        if (!isValidExtensionId(realtimeRegisteredExtensionId)) return;
        if (!hasChromeRuntime()) return;

        try {
            await sendMessageToExtension(realtimeRegisteredExtensionId, {
                type: 'PT_UNREGISTER_DASHBOARD',
                dashboardId: chrome.runtime.id
            });
        } catch (_err) {
            // ignore unregister failures
        }
    }

    async function readFromProblemTrackerExtension() {
        const candidateIds = [];
        const cachedId = localStorage.getItem(EXTENSION_ID_CACHE_KEY);

        if (isValidExtensionId(cachedId)) {
            candidateIds.push(cachedId);
        }

        const discoveredIds = await discoverCandidateExtensionIds();
        for (let i = 0; i < discoveredIds.length; i += 1) {
            const discoveredId = discoveredIds[i];
            if (isValidExtensionId(discoveredId) && candidateIds.indexOf(discoveredId) === -1) {
                candidateIds.push(discoveredId);
            }
        }

        for (let i = 0; i < candidateIds.length; i += 1) {
            const extensionId = candidateIds[i];

            try {
                const response = await sendMessageToExtension(extensionId, { type: 'PT_GET_COLLECTIONS' });
                if (!response || !response.ok) continue;

                localStorage.setItem(EXTENSION_ID_CACHE_KEY, extensionId);
                await registerRealtimeUpdates(extensionId);

                return {
                    extensionId: extensionId,
                    data: normalizeCollections(response)
                };
            } catch (_err) {
                // try next candidate id
            }
        }

        return null;
    }

    function titleFromUrl(url) {
        try {
            const pathname = new URL(url).pathname;
            const segment = pathname.split('/').filter(Boolean).pop() || url;
            return segment
                .replace(/[-_]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/\b\w/g, function (char) {
                    return char.toUpperCase();
                });
        } catch (_err) {
            return url;
        }
    }

    function pickFirstText(raw, keys) {
        if (!raw || typeof raw !== 'object') return '';

        for (let i = 0; i < keys.length; i += 1) {
            const value = raw[keys[i]];
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }

        return '';
    }

    function normalizeProblem(raw) {
        if (typeof raw === 'string') {
            raw = { url: raw };
        }

        if (!raw || typeof raw !== 'object') return null;

        const url = pickFirstText(raw, ['url', 'link', 'href', 'questionUrl']);
        if (!url) return null;

        const name = pickFirstText(raw, ['name', 'title', 'questionName']) || titleFromUrl(url);

        const matchKey = getQuestionMatchKey(url);

        return {
            id: raw.id || url,
            url: url,
            matchKey: matchKey,
            name: name,
            status: !!raw.status,
            revision: !!raw.revision
        };
    }

    function normalizePath(path) {
        const cleaned = String(path || '').replace(/\/+/g, '/');
        return cleaned.endsWith('/') ? cleaned : cleaned + '/';
    }

    function parseQuestionUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') {
            return { normalizedUrl: '', matchKey: '' };
        }

        try {
            const parsed = new URL(rawUrl);
            const host = parsed.hostname.toLowerCase();
            const parts = parsed.pathname.split('/').filter(Boolean);

            let normalizedPath = parsed.pathname;
            let keyPath = parsed.pathname;

            if (host.includes('leetcode.com')) {
                const idx = parts.indexOf('problems');
                if (idx >= 0 && parts[idx + 1]) {
                    normalizedPath = '/problems/' + parts[idx + 1] + '/';
                    keyPath = normalizedPath;
                }
            } else if (host.includes('geeksforgeeks.org')) {
                const idx = parts.indexOf('problems');
                if (idx >= 0 && parts[idx + 1]) {
                    const maybeVariant = parts[idx + 2] && /^\d+$/.test(parts[idx + 2]) ? parts[idx + 2] : null;
                    normalizedPath = maybeVariant
                        ? '/problems/' + parts[idx + 1] + '/' + maybeVariant + '/'
                        : '/problems/' + parts[idx + 1] + '/';
                    keyPath = '/problems/' + parts[idx + 1] + '/';
                }
            } else if (host.includes('hackerrank.com')) {
                const idx = parts.indexOf('challenges');
                if (idx >= 0 && parts[idx + 1]) {
                    normalizedPath = '/challenges/' + parts[idx + 1] + '/';
                    keyPath = normalizedPath;
                }
            } else if (host.includes('codeforces.com')) {
                if (parts[0] === 'problemset' && parts[1] === 'problem' && parts[2] && parts[3]) {
                    normalizedPath = '/problemset/problem/' + parts[2] + '/' + parts[3] + '/';
                    keyPath = normalizedPath;
                }
            } else if (host.includes('naukri.com')) {
                if (parts[0] === 'code360' && parts[1] === 'problems' && parts[2]) {
                    normalizedPath = '/code360/problems/' + parts[2] + '/';
                    keyPath = normalizedPath;
                }
            }

            normalizedPath = normalizePath(normalizedPath);
            keyPath = normalizePath(keyPath);

            return {
                normalizedUrl: parsed.origin + normalizedPath,
                matchKey: parsed.origin + keyPath
            };
        } catch (_err) {
            const base = String(rawUrl).split(/[?#]/)[0].replace(/\/+$/, '');
            const fallback = base ? base + '/' : '';
            return { normalizedUrl: fallback, matchKey: fallback };
        }
    }

    function getQuestionMatchKey(rawUrl) {
        return parseQuestionUrl(rawUrl).matchKey;
    }

    function uniqueProblems(list) {
        const byKey = new Map();

        if (!Array.isArray(list)) return [];

        for (let i = 0; i < list.length; i += 1) {
            const normalized = normalizeProblem(list[i]);
            if (!normalized) continue;

            const key = normalized.matchKey || normalized.url;
            const existing = byKey.get(key);
            if (!existing) {
                byKey.set(key, normalized);
                continue;
            }

            byKey.set(key, {
                id: existing.id,
                url: existing.url,
                matchKey: existing.matchKey || key,
                name: existing.name && existing.name !== existing.url ? existing.name : normalized.name,
                status: existing.status || normalized.status,
                revision: existing.revision || normalized.revision
            });
        }

        return Array.from(byKey.values()).slice(0, MAX_VISIBLE);
    }

    function hostLabel(url) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            if (host.includes('leetcode')) return 'LeetCode';
            if (host.includes('geeksforgeeks')) return 'GFG';
            if (host.includes('codeforces')) return 'Codeforces';
            if (host.includes('naukri')) return 'Code360';
            return host.replace(/^www\./, '').split('.')[0] || 'Site';
        } catch (_err) {
            return 'Site';
        }
    }

    function createTag(text, className) {
        const tag = document.createElement('span');
        tag.className = 'problem-tag ' + className;
        tag.textContent = text;
        return tag;
    }

    function renderProblems(targetListEl, targetEmptyEl, problems, mode) {
        targetListEl.innerHTML = '';

        if (!problems.length) {
            targetEmptyEl.classList.remove('hidden');
            return;
        }

        targetEmptyEl.classList.add('hidden');

        for (let i = 0; i < problems.length; i += 1) {
            const problem = problems[i];

            const item = document.createElement('li');
            item.className = 'problem-item';

            const meta = document.createElement('div');
            meta.className = 'problem-meta';

            const source = document.createElement('span');
            source.className = 'problem-source';
            source.textContent = hostLabel(problem.url);
            meta.appendChild(source);

            if (problem.status) {
                const doneDot = document.createElement('span');
                doneDot.className = 'problem-done-dot';
                doneDot.title = 'Completed';
                meta.appendChild(doneDot);
            }

            const link = document.createElement('a');
            link.className = 'problem-link';
            link.href = problem.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = problem.name;
            link.title = problem.url;

            const tags = document.createElement('div');
            tags.className = 'problem-tags';

            if (mode === 'revision') {
                tags.appendChild(createTag('rev', 'rev'));
            } else if (problem.status) {
                tags.appendChild(createTag('done', 'done'));
            }

            item.appendChild(meta);
            item.appendChild(link);
            item.appendChild(tags);
            targetListEl.appendChild(item);
        }
    }

    function updateCounts(savedCount, revisionCount) {
        const saved = String(savedCount);
        const revision = String(revisionCount);

        savedCountEl.textContent = saved;
        revisionCountEl.textContent = revision;
        tabSavedCountEl.textContent = saved;
        tabRevisionCountEl.textContent = revision;
    }

    function applyCollections(collections, sourceLabel) {
        const normalized = normalizeCollections(collections || {});

        const movedToRevision = normalized.myQuestions.filter(function (q) {
            return !!(q && q.revision);
        });

        const revisionProblems = uniqueProblems(normalized.revisionList.concat(movedToRevision));
        const revisionKeys = new Set(revisionProblems.map(function (q) { return q.matchKey || q.url; }));

        const savedProblems = uniqueProblems(normalized.myQuestions).filter(function (q) {
            const key = q.matchKey || q.url;
            return !revisionKeys.has(key);
        });

        renderProblems(savedListEl, savedEmptyEl, savedProblems, 'saved');
        renderProblems(revisionListEl, revisionEmptyEl, revisionProblems, 'revision');
        updateCounts(savedProblems.length, revisionProblems.length);

        if (savedProblems.length === 0 && revisionProblems.length === 0) {
            setStatus('ok', sourceLabel + ' empty');
        } else {
            setStatus('ok', savedProblems.length + ' to-do | ' + revisionProblems.length + ' revision');
        }
    }

    async function loadProblems() {
        if (loading) return;
        loading = true;

        setStatus('loading', 'syncing');

        try {
            const externalResult = await readFromProblemTrackerExtension();

            if (externalResult) {
                setConnectState(true);
                applyCollections(externalResult.data, 'problem tracker');
                return;
            }

            setConnectState(false);

            const local = await readFromCurrentExtensionStorage();
            const fallback = readFromLocalStorage();
            const merged = mergeCollections([local, fallback]);
            const mergedTotal = merged.myQuestions.length + merged.revisionList.length;

            if (mergedTotal > 0) {
                applyCollections(merged, 'dashboard local');
            } else {
                applyCollections(merged, 'connect extension');
            }
        } catch (_err) {
            setConnectState(false);
            setStatus('error', 'sync failed');
        } finally {
            loading = false;
        }
    }

    function handleConnectClick() {
        const current = localStorage.getItem(EXTENSION_ID_CACHE_KEY) || '';
        const input = prompt('Enter Problem Tracker extension ID (32 chars). Leave empty for auto-discovery.', current);

        if (input === null) return;

        const next = input.trim();

        if (!next) {
            localStorage.removeItem(EXTENSION_ID_CACHE_KEY);
            realtimeRegisteredExtensionId = null;
            loadProblems();
            return;
        }

        if (!isValidExtensionId(next)) {
            alert('Invalid extension ID. It should be 32 lowercase letters (a-p).');
            return;
        }

        localStorage.setItem(EXTENSION_ID_CACHE_KEY, next);
        realtimeRegisteredExtensionId = null;
        loadProblems();
    }

    function handleRealtimeMessage(message, sender, sendResponse) {
        if (!message || message.type !== 'PT_COLLECTIONS_UPDATED') return;

        const senderId = sender && sender.id ? sender.id : '';
        const cachedId = localStorage.getItem(EXTENSION_ID_CACHE_KEY);

        if (isValidExtensionId(cachedId) && senderId && senderId !== cachedId) {
            if (typeof sendResponse === 'function') sendResponse({ ok: false });
            return true;
        }

        if (isValidExtensionId(senderId)) {
            localStorage.setItem(EXTENSION_ID_CACHE_KEY, senderId);
            realtimeRegisteredExtensionId = senderId;
            setConnectState(true);
        }

        applyCollections(message, 'live');

        if (typeof sendResponse === 'function') {
            sendResponse({ ok: true });
        }

        return true;
    }

    tabSavedBtn.addEventListener('click', function () {
        setActiveTab('saved');
    });

    tabRevisionBtn.addEventListener('click', function () {
        setActiveTab('revision');
    });

    connectBtn.addEventListener('click', handleConnectClick);

    if (hasChromeRuntime() && chrome.runtime.onMessageExternal) {
        chrome.runtime.onMessageExternal.addListener(handleRealtimeMessage);
    }

    setConnectState(false);
    setActiveTab(getSavedActiveTab());
    loadProblems();

    if (hasChromeStorage() && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            if (!changes.myQuestions && !changes.revisionList) return;
            loadProblems();
        });
    }

    window.addEventListener('focus', loadProblems);
    window.addEventListener('beforeunload', unregisterRealtimeUpdates);
})();
