/* ═══════════════════════════════════════════════════════
   Production Developer New Tab Dashboard
   ═══════════════════════════════════════════════════════ */
'use strict';

/* ── Helpers ── */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const pad = (n) => String(n).padStart(2, '0');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
function weekNum(d) { const j = new Date(d.getFullYear(), 0, 1); return Math.ceil(((d - j) / 864e5 + j.getDay() + 1) / 7); }
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

/* ══════════════════════════════════════════════════════
   1. MATRIX RAIN BACKGROUND
   ══════════════════════════════════════════════════════ */
(function initMatrix() {
    const c = document.getElementById('bg-canvas');
    const ctx = c.getContext('2d');
    const resize = () => { c.width = innerWidth; c.height = innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const chars = '01アイウエオカキ{}[]<>/|\\ABCDEF';
    let drops = [];
    const resetDrops = () => {
        drops = Array.from({ length: Math.floor(c.width / 18) }, () => Math.random() * -60);
    };
    resetDrops();
    window.addEventListener('resize', resetDrops);

    setInterval(() => {
        ctx.fillStyle = 'rgba(8,9,12,0.06)';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.font = '13px "Geist Mono",monospace';
        drops.forEach((y, i) => {
            ctx.fillStyle = 'rgba(16,185,129,' + (Math.random() * 0.35 + 0.06) + ')';
            ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * 18, y * 18);
            if (y * 18 > c.height && Math.random() > 0.975) drops[i] = 0;
            drops[i] += 0.4;
        });
    }, 80);
})();

/* ══════════════════════════════════════════════════════
   2. LIVE CLOCK
   ══════════════════════════════════════════════════════ */
const SESSION_START = Date.now();

function updateClock() {
    const n = new Date();
    $('#tbclock').textContent = pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds());
    $('#chm').textContent = pad(n.getHours()) + ':' + pad(n.getMinutes());
    $('#cs').textContent = ':' + pad(n.getSeconds());
    $('#cdate').textContent = DAYS[n.getDay()] + ' \u00b7 ' + MONTHS[n.getMonth()] + ' ' + n.getDate() + ', ' + n.getFullYear();
    $('#wk').textContent = weekNum(n);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ');
    $('#tz-badge').textContent = tz;
    $('#tb-tz').textContent = tz;

    const elapsed = Math.floor((Date.now() - SESSION_START) / 1000);
    $('#upt').textContent = pad(Math.floor(elapsed / 3600)) + ':' + pad(Math.floor((elapsed % 3600) / 60)) + ':' + pad(elapsed % 60);
}

updateClock();
setInterval(updateClock, 1000);
$('#sid').textContent = Math.random().toString(36).slice(2, 8).toUpperCase();

/* ══════════════════════════════════════════════════════
   2b. INTERNET SPEED METER
   ══════════════════════════════════════════════════════ */
(function initSpeedMeter() {
    var prevDown = 0, prevUp = 0, prevTime = performance.now();

    function fmtSpeed(bytesPerSec) {
        if (bytesPerSec >= 1048576) return (bytesPerSec / 1048576).toFixed(1) + ' MB/s';
        if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(0) + ' KB/s';
        return bytesPerSec.toFixed(0) + ' B/s';
    }

    // Use Navigation/Resource Timing API to track real network traffic
    function measure() {
        var now = performance.now();
        var dt = (now - prevTime) / 1000; // seconds
        if (dt < 0.5) return;

        var entries = performance.getEntriesByType('resource');
        var totalDown = 0, totalUp = 0;

        entries.forEach(function (e) {
            // transferSize = bytes downloaded; approximate upload from request
            if (e.transferSize) totalDown += e.transferSize;
            if (e.encodedBodySize) totalDown += e.encodedBodySize;
            // Estimate upload: POST/PUT requests with body
            if (e.initiatorType === 'xmlhttprequest' || e.initiatorType === 'fetch') {
                totalUp += (e.requestStart && e.responseStart) ? Math.max(0, (e.responseStart - e.requestStart) * 800) : 0;
            }
        });

        var downDiff = Math.max(0, totalDown - prevDown);
        var upDiff = Math.max(0, totalUp - prevUp);

        var downSpeed = downDiff / dt;
        var upSpeed = upDiff / dt;

        prevDown = totalDown;
        prevUp = totalUp;
        prevTime = now;

        var elUp = $('#speed-up');
        var elDown = $('#speed-down');
        if (elUp) elUp.textContent = fmtSpeed(upSpeed);
        if (elDown) elDown.textContent = fmtSpeed(downSpeed);
    }

    // Also use Network Information API if available
    if (navigator.connection) {
        var conn = navigator.connection;
        function updateConnInfo() {
            // downlink is in Mbps
            if (conn.downlink !== undefined) {
                var elDown = $('#speed-down');
                var bps = conn.downlink * 125000; // Mbps to bytes/sec
                if (bps > 0 && elDown) elDown.textContent = fmtSpeed(bps);
            }
        }
        conn.addEventListener('change', updateConnInfo);
        updateConnInfo();
    }

    // Clear resource buffer periodically to prevent memory buildup
    setInterval(function () {
        measure();
        try { performance.clearResourceTimings(); } catch (e) { }
        prevDown = 0;
        prevUp = 0;
    }, 2000);
})();

/* ══════════════════════════════════════════════════════
   3. MULTI-ENGINE SEARCH
   ══════════════════════════════════════════════════════ */
const ENGINES = [
    {
        id: 'google', label: 'Google', url: 'https://google.com/search?q=',
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>',
        color: '#4285F4'
    },
    {
        id: 'ddg', label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=',
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="#DE5833"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-2.13c-1.76-.46-3-2.05-3-3.87 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.82-1.24 3.41-3 3.87V16.5h-2z"/></svg>',
        color: '#DE5833'
    },
    {
        id: 'gh', label: 'GitHub', url: 'https://github.com/search?q=',
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="#e6edf3"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>',
        color: '#e6edf3'
    },
    {
        id: 'mdn', label: 'MDN', url: 'https://developer.mozilla.org/en-US/search?q=',
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#83d0f2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
        color: '#83d0f2'
    },
    {
        id: 'npm', label: 'npm', url: 'https://npmjs.com/search?q=',
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="#CB3837"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323h13.837v13.629h-3.502V8.647h-3.348v10.305H5.13z"/></svg>',
        color: '#CB3837'
    },
    {
        id: 'yt', label: 'YouTube', url: 'https://youtube.com/results?search_query=',
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
        color: '#FF0000'
    },
];

let activeEngine = 0;
const pillsContainer = $('#epills');

ENGINES.forEach((e, i) => {
    const b = document.createElement('button');
    b.className = 'epill' + (i === 0 ? ' active' : '');
    b.innerHTML = '<span class="epill-icon">' + e.icon + '</span>' + e.label;
    b.addEventListener('click', () => setEngine(i));
    pillsContainer.appendChild(b);
});

function setEngine(i) {
    activeEngine = i;
    $$('.epill').forEach((b, j) => b.classList.toggle('active', j === i));
    $('#eng-name').textContent = ENGINES[i].label;
    $('#eng-active').textContent = ENGINES[i].label.toLowerCase();
    $('#eng-icon').innerHTML = ENGINES[i].icon;
    // Update search bar focus color
    document.documentElement.style.setProperty('--search-accent', ENGINES[i].color);
}

$('#eng-badge').addEventListener('click', () => setEngine((activeEngine + 1) % ENGINES.length));
setEngine(0); // Initialize with icons and color

function doSearch() {
    const q = $('#searchInput').value.trim();
    if (!q) return;
    const url = /^https?:\/\//.test(q) ? q : ENGINES[activeEngine].url + encodeURIComponent(q);
    $('#searchInput').value = "";
    window.open(url, '_self', 'noopener,noreferrer');
}

$('#s-go').addEventListener('click', doSearch);
$('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        $('#searchInput').focus();
        $('#searchInput').select();
    }
});

/* ══════════════════════════════════════════════════════
   4. GITHUB INTEGRATION
   ══════════════════════════════════════════════════════ */
const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#2b7489', Python: '#3572A5', Java: '#b07219',
    'C++': '#f34b7d', C: '#555555', Rust: '#dea584', Go: '#00ADD8',
    Ruby: '#701516', Swift: '#ffac45', Kotlin: '#F18E33', PHP: '#4F5D95',
    CSS: '#563d7c', HTML: '#e34c26', Shell: '#89e051', Dart: '#00B4AB',
    Vue: '#41b883', default: '#8b949e'
};

let savedGHUser = localStorage.getItem('gh_user') || '';

function bindGHForm() {
    const btn = $('#gh-btn');
    const inp = $('#ghu');
    if (!btn || !inp) return;
    const go = () => { const v = inp.value.trim(); if (v) loadGitHub(v); };
    btn.onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
}
bindGHForm();

async function loadGitHub(username) {
    username = username.trim();

    // Check cache first to avoid rate limiting (10 min TTL)
    var GH_CACHE_KEY = 'gh_cache_' + username.toLowerCase();
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(GH_CACHE_KEY)); } catch (e) { /* ignore */ }
    if (cached && cached.ts && (Date.now() - cached.ts < 600000)) {
        // Use cached data
        savedGHUser = username;
        localStorage.setItem('gh_user', username);
        $('#tb-user').textContent = username;
        renderGHProfile(cached.profile, cached.repos);
        $('#contrib-user-label').textContent = '@' + username;
        if (cached.cmap && Object.keys(cached.cmap).length > 0) {
            renderHeatmap(cached.cmap);
        } else {
            $('#contrib-content').innerHTML = '<div class="ls"><div class="spinner"></div><span>loading contributions\u2026</span></div>';
            await loadContributions(username, cached.repos);
        }
        return;
    }

    $('#gh-setup').innerHTML = '<div class="ls"><div class="spinner"></div><span>fetching ' + escapeHtml(username) + '\u2026</span></div>';

    try {
        const profileRes = await fetch('https://api.github.com/users/' + encodeURIComponent(username));
        if (!profileRes.ok) {
            var remaining = profileRes.headers.get('X-RateLimit-Remaining');
            if (remaining === '0' || profileRes.status === 403) {
                var resetTime = profileRes.headers.get('X-RateLimit-Reset');
                var waitMin = resetTime ? Math.ceil((parseInt(resetTime) * 1000 - Date.now()) / 60000) : '~60';
                throw new Error('Rate limited. Resets in ' + waitMin + ' min. Try adding a GitHub token.');
            }
            throw new Error(profileRes.status === 404 ? 'User not found' : 'GitHub API error (' + profileRes.status + ')');
        }

        const profile = await profileRes.json();
        const reposRes = await fetch('https://api.github.com/users/' + encodeURIComponent(username) + '/repos?per_page=100&sort=pushed');
        const repos = reposRes.ok ? await reposRes.json() : [];

        // Cache the response
        try {
            localStorage.setItem(GH_CACHE_KEY, JSON.stringify({ ts: Date.now(), profile: profile, repos: repos }));
        } catch (e) { /* storage full, ignore */ }

        localStorage.setItem('gh_user', username);
        savedGHUser = username;
        $('#tb-user').textContent = username;
        renderGHProfile(profile, repos);

        $('#contrib-user-label').textContent = '@' + username;
        $('#contrib-content').innerHTML = '<div class="ls"><div class="spinner"></div><span>loading contributions\u2026</span></div>';
        await loadContributions(username, repos);
    } catch (err) {
        // If rate limited but we have OLD cache, use it
        if (cached && cached.profile) {
            savedGHUser = username;
            localStorage.setItem('gh_user', username);
            $('#tb-user').textContent = username;
            renderGHProfile(cached.profile, cached.repos);
            $('#contrib-user-label').textContent = '@' + username;
            if (cached.cmap) renderHeatmap(cached.cmap);
            return;
        }
        $('#gh-setup').innerHTML =
            '<p class="gh-setup-text">Enter your GitHub username</p>' +
            '<div class="flex-row"><input class="gh-input" id="ghu" placeholder="e.g. torvalds" autocomplete="off"/>' +
            '<button class="btn-p" id="gh-btn">Load</button></div>' +
            '<div class="gh-error">\u26a0 ' + escapeHtml(err.message) + '</div>';
        bindGHForm();
    }
}

function renderGHProfile(p, repos) {
    $('#gh-setup').classList.add('hidden');
    $('#gh-prof').classList.remove('hidden');
    $('#gh-sb').innerHTML = '<div class="badge-g">\u2b21 connected</div>';
    $('#gh-av').src = p.avatar_url;
    $('#gh-nm').textContent = p.name || p.login;
    $('#gh-lg').textContent = '@' + p.login;
    $('#gh-bio').textContent = p.bio || '';
    $('#gh-repos').textContent = fmt(p.public_repos);
    $('#gh-fol').textContent = fmt(p.followers);
    $('#gh-fng').textContent = fmt(p.following);

    // Languages breakdown
    const langMap = {};
    repos.forEach((r) => { if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1; });
    const sorted = Object.entries(langMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = sorted.reduce((s, e) => s + e[1], 0);
    const langEl = $('#gh-langs');
    langEl.innerHTML = '';
    sorted.forEach(([lang, cnt]) => {
        const pct = ((cnt / total) * 100).toFixed(0);
        const col = LANG_COLORS[lang] || LANG_COLORS.default;
        langEl.innerHTML +=
            '<div class="lrow"><div class="lname"><span class="ldot" style="background:' + col + '"></span>' + escapeHtml(lang) + '</div><div class="lpct">' + pct + '%</div></div>' +
            '<div class="lbar"><div class="lbar-f" style="width:' + pct + '%;background:' + col + '"></div></div>';
    });

    // Top repos
    const topRepos = repos.filter((r) => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5);
    const reposList = $('#repos-list');
    if (reposList) {
        reposList.innerHTML = '';
        topRepos.forEach((r) => {
            const col = LANG_COLORS[r.language] || LANG_COLORS.default;
            reposList.innerHTML +=
                '<a class="ri" href="' + r.html_url + '" target="_blank" rel="noopener noreferrer">' +
                '<div class="ri-name">' + escapeHtml(r.name) + '</div>' +
                '<div class="ri-desc">' + escapeHtml(r.description || 'No description') + '</div>' +
                '<div class="ri-meta">' +
                (r.language ? '<span><span style="background:' + col + ';width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:2px"></span>' + escapeHtml(r.language) + '</span>' : '') +
                '<span>\u2605 ' + fmt(r.stargazers_count) + '</span>' +
                '<span>\u2442 ' + fmt(r.forks_count) + '</span>' +
                '</div></a>';
        });
    }
    var reposMeta = $('#repos-meta');
    if (reposMeta) reposMeta.textContent = topRepos.length + ' repos';

    // Reset button
    $('#gh-reset-btn').onclick = resetGitHub;
}

function resetGitHub() {
    localStorage.removeItem('gh_user');
    savedGHUser = '';
    $('#gh-prof').classList.add('hidden');
    $('#gh-sb').innerHTML = '';
    $('#gh-setup').innerHTML =
        '<p class="gh-setup-text">Enter your GitHub username</p>' +
        '<div class="flex-row"><input class="gh-input" id="ghu" placeholder="e.g. torvalds" autocomplete="off"/>' +
        '<button class="btn-p" id="gh-btn">Load</button></div>';
    $('#gh-setup').classList.remove('hidden');
    bindGHForm();
    $('#contrib-content').innerHTML = '<div class="ls contrib-empty"><span class="contrib-hint">Load a GitHub profile \u2190 to see real commit history</span></div>';
    $('#contrib-user-label').textContent = '';
    var rl = $('#repos-list'); if (rl) rl.innerHTML = '<div class="repos-empty">Load a GitHub profile to see repos</div>';
    $('#tb-user').textContent = 'user';
}

/* ── Contribution Heatmap ── */
async function loadContributions(username, repos) {
    const cmap = {};

    // Strategy 1: Scrape GitHub contribution calendar with DOMParser (most complete — full year)
    try {
        var calRes = await fetch('https://github.com/users/' + encodeURIComponent(username) + '/contributions');
        if (calRes.ok) {
            var html = await calRes.text();
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            // Find all elements with data-date (contribution cells)
            var cells = doc.querySelectorAll('[data-date]');
            cells.forEach(function (cell) {
                var d = cell.getAttribute('data-date');
                if (!d) return;
                // Try data-count first
                var count = cell.getAttribute('data-count');
                if (count !== null) {
                    var c = parseInt(count, 10);
                    if (c > 0) cmap[d] = Math.max(cmap[d] || 0, c);
                    return;
                }
                // Try data-level
                var level = cell.getAttribute('data-level');
                if (level !== null && level !== '0') {
                    var lvlMap = { '1': 2, '2': 5, '3': 8, '4': 12 };
                    var val = lvlMap[level] || 0;
                    if (val > 0) cmap[d] = Math.max(cmap[d] || 0, val);
                }
            });
            // Also try parsing tooltip text inside the calendar
            if (Object.keys(cmap).length === 0) {
                var tooltips = doc.querySelectorAll('tool-tip, .sr-only');
                tooltips.forEach(function (tip) {
                    var text = tip.textContent || '';
                    var m = text.match(/(\d+)\s+contributions?\s+on\s+\w+\s+(\w+)\s+(\d+)/);
                    if (m) {
                        // Find the closest element with data-date
                        var parent = tip.closest('[data-date]') || (tip.previousElementSibling && tip.previousElementSibling.closest('[data-date]'));
                        if (parent) {
                            var d = parent.getAttribute('data-date');
                            var c = parseInt(m[1], 10);
                            if (d && c > 0) cmap[d] = Math.max(cmap[d] || 0, c);
                        }
                    }
                });
            }
        }
    } catch (e) { console.warn('[DevTab] Calendar scrape failed:', e); }

    // Strategy 2: GitHub Events API (reliable JSON, recent ~90 days)
    try {
        var pages = [1, 2, 3];
        var results = await Promise.all(pages.map(function (p) {
            return fetch('https://api.github.com/users/' + encodeURIComponent(username) + '/events/public?per_page=100&page=' + p)
                .then(function (r) { return r.ok ? r.json() : []; })
                .catch(function () { return []; });
        }));
        results.forEach(function (events) {
            if (!Array.isArray(events)) return;
            events.forEach(function (ev) {
                var d = ev.created_at && ev.created_at.split('T')[0];
                if (!d) return;
                if (ev.type === 'PushEvent') {
                    cmap[d] = (cmap[d] || 0) + (ev.payload && ev.payload.commits ? ev.payload.commits.length : 1);
                } else if (['CreateEvent', 'IssuesEvent', 'PullRequestEvent', 'WatchEvent', 'ForkEvent', 'IssueCommentEvent', 'PullRequestReviewEvent'].indexOf(ev.type) !== -1) {
                    cmap[d] = (cmap[d] || 0) + 1;
                }
            });
        });
    } catch (e) { console.warn('[DevTab] Events API failed:', e); }

    // Strategy 3: Fetch commit history from repos
    try {
        var topRepos = (repos || []).filter(function (r) { return !r.fork; })
            .sort(function (a, b) { return b.pushed_at > a.pushed_at ? 1 : -1; }).slice(0, 5);
        // Also include forked repos if we don't have enough non-fork repos
        if (topRepos.length < 3) {
            var forked = (repos || []).filter(function (r) { return r.fork; })
                .sort(function (a, b) { return b.pushed_at > a.pushed_at ? 1 : -1; }).slice(0, 5 - topRepos.length);
            topRepos = topRepos.concat(forked);
        }
        await Promise.all(topRepos.map(function (r) {
            return fetch('https://api.github.com/repos/' + encodeURIComponent(username) + '/' + encodeURIComponent(r.name) + '/commits?per_page=100&author=' + encodeURIComponent(username))
                .then(function (res) { return res.ok ? res.json() : []; })
                .then(function (commits) {
                    if (!Array.isArray(commits)) return;
                    commits.forEach(function (c) {
                        var dt = c.commit && c.commit.author && c.commit.author.date;
                        if (dt) { var d = dt.split('T')[0]; cmap[d] = (cmap[d] || 0) + 1; }
                    });
                })
                .catch(function () { /* skip */ });
        }));
    } catch (e) { console.warn('[DevTab] Repo commits failed:', e); }

    console.log('[DevTab] Contribution data collected:', Object.keys(cmap).length, 'days');

    renderHeatmap(cmap);

    // Cache the contribution map
    var GH_CACHE_KEY = 'gh_cache_' + username.toLowerCase();
    try {
        var existing = JSON.parse(localStorage.getItem(GH_CACHE_KEY)) || {};
        existing.cmap = cmap;
        localStorage.setItem(GH_CACHE_KEY, JSON.stringify(existing));
    } catch (e) { /* ignore */ }
}

function renderHeatmap(cmap) {
    const el = $('#contrib-content');
    const total = Object.values(cmap).reduce((s, v) => s + v, 0);
    const today = new Date();

    // Build weeks — end on today, start from the Sunday 52 weeks ago
    const end = new Date(today);
    const start = new Date(today);
    start.setDate(start.getDate() - 52 * 7 - start.getDay());

    const weeks = [];
    let cur = new Date(start);
    while (cur <= end) {
        const w = [];
        for (let d = 0; d < 7 && cur <= end; d++) {
            const ds = cur.toISOString().split('T')[0];
            w.push({ date: ds, count: cmap[ds] || 0, future: false });
            cur.setDate(cur.getDate() + 1);
        }
        weeks.push(w);
    }

    const maxC = Math.max(...Object.values(cmap), 1);
    const lvl = (n) => {
        if (!n) return 0;
        if (n <= Math.ceil(maxC * 0.25)) return 1;
        if (n <= Math.ceil(maxC * 0.5)) return 2;
        if (n <= Math.ceil(maxC * 0.75)) return 3;
        return 4;
    };

    // Month labels
    let mhtml = '<div class="contrib-months">';
    let lastM = -1;
    weeks.forEach((w) => {
        const fd = new Date(w[0].date);
        if (fd.getMonth() !== lastM && fd.getDate() <= 8) {
            mhtml += '<span class="cmonth-label">' + MS[fd.getMonth()] + '</span>';
            lastM = fd.getMonth();
        } else {
            mhtml += '<span class="cmonth-spacer"></span>';
        }
    });
    mhtml += '</div>';

    // Grid
    let ghtml = '<div class="contrib-wrap"><div class="c-days">' +
        '<div class="c-day-l"></div><div class="c-day-l c-day-label-gap">Mon</div>' +
        '<div class="c-day-l"></div><div class="c-day-l c-day-label-gap">Wed</div>' +
        '<div class="c-day-l"></div><div class="c-day-l c-day-label-gap">Fri</div>' +
        '<div class="c-day-l"></div></div><div class="cgrid" style="grid-template-columns:repeat(' + weeks.length + ',1fr)">';

    weeks.forEach((w) => {
        ghtml += '<div class="cweek">';
        w.forEach((cell) => {
            const l = cell.future ? 0 : lvl(cell.count);
            ghtml += '<div class="ccell" data-l="' + l + '" data-c="' + cell.count + '" data-d="' + cell.date + '"></div>';
        });
        ghtml += '</div>';
    });
    ghtml += '</div></div>';

    // Streaks
    let maxStreak = 0, run = 0, prev = null;
    Object.keys(cmap).sort().reverse().forEach((d) => {
        if (!prev) { run = 1; } else {
            const diff = (new Date(prev) - new Date(d)) / 864e5;
            run = diff === 1 ? run + 1 : 1;
        }
        if (run > maxStreak) maxStreak = run;
        prev = d;
    });

    let currentStreak = 0;
    const cd = new Date(today);
    while (true) {
        const ds = cd.toISOString().split('T')[0];
        if (cmap[ds]) { currentStreak++; cd.setDate(cd.getDate() - 1); }
        else break;
    }

    const statsHtml =
        '<div class="c-legend"><span>Less</span><div class="lcells">' +
        '<div class="lc clevel-0"></div>' +
        '<div class="lc clevel-1"></div>' +
        '<div class="lc clevel-2"></div>' +
        '<div class="lc clevel-3"></div>' +
        '<div class="lc clevel-4"></div>' +
        '</div><span>More</span></div>' +
        '<div class="c-nums">' +
        '<div><div class="cnum-v">' + total + '</div><div class="cnum-k">contributions</div></div>' +
        '<div><div class="cnum-v">' + currentStreak + ' \ud83d\udd25</div><div class="cnum-k">streak</div></div>' +
        '<div><div class="cnum-v">' + maxStreak + '</div><div class="cnum-k">best streak</div></div>' +
        '<div><div class="cnum-v">' + Object.keys(cmap).length + '</div><div class="cnum-k">active days</div></div>' +
        '</div>';

    el.innerHTML = mhtml + ghtml + statsHtml;

    // Tooltip
    const tt = $('#tt');
    el.querySelectorAll('.ccell').forEach((cell) => {
        cell.addEventListener('mouseenter', () => {
            const c = cell.dataset.c;
            const d = cell.dataset.d;
            const date = new Date(d + 'T12:00:00');
            tt.innerHTML = '<b>' + (c === '0' ? 'No contributions' : c + ' contribution' + (c > 1 ? 's' : '')) + '</b> \u00b7 ' + DAYS[date.getDay()] + ', ' + MS[date.getMonth()] + ' ' + date.getDate();
            tt.style.display = 'block';
        });
        cell.addEventListener('mousemove', (e) => {
            tt.style.left = (e.clientX + 14) + 'px';
            tt.style.top = (e.clientY - 38) + 'px';
        });
        cell.addEventListener('mouseleave', () => { tt.style.display = 'none'; });
    });
}

/* ══════════════════════════════════════════════════════
   5. LEETCODE TRACKER
   ══════════════════════════════════════════════════════ */
let savedLCUser = localStorage.getItem('lc_user') || '';

function bindLCForm() {
    const btn = $('#lc-btn');
    const inp = $('#lc-username');
    if (!btn || !inp) return;
    const go = () => { const v = inp.value.trim(); if (v) loadLeetCode(v); };
    btn.onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
}
bindLCForm();

async function loadLeetCode(username) {
    username = username.trim();

    // Check cache (5 min TTL)
    var LC_CACHE_KEY = 'lc_cache_' + username.toLowerCase();
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(LC_CACHE_KEY)); } catch (e) { /* ignore */ }
    if (cached && cached.ts && (Date.now() - cached.ts < 300000)) {
        savedLCUser = username;
        localStorage.setItem('lc_user', username);
        renderLeetCode(cached.data, username);
        return;
    }

    $('#lc-setup').innerHTML = '<div class="ls"><div class="spinner"></div><span>fetching ' + escapeHtml(username) + '\u2026</span></div>';

    // Helper: fetch with AbortController timeout
    function timedFetch(url, opts, ms) {
        var c = new AbortController();
        var t = setTimeout(function () { c.abort(); }, ms);
        opts = Object.assign({}, opts || {}, { signal: c.signal });
        return fetch(url, opts).finally(function () { clearTimeout(t); });
    }

    // GraphQL query body (using variables for safety)
    var gqlQuery = 'query($username:String!){matchedUser(username:$username){submitStatsGlobal{acSubmissionNum{difficulty count}}profile{ranking reputation}}allQuestionsCount{difficulty count}}';
    var gqlBody = JSON.stringify({ query: gqlQuery, variables: { username: username } });

    // Parse LeetCode GraphQL response into normalized data
    function parseGQL(json) {
        if (!json || !json.data || !json.data.matchedUser) throw new Error('User not found');
        var mu = json.data.matchedUser;
        var subs = mu.submitStatsGlobal ? mu.submitStatsGlobal.acSubmissionNum : [];
        var totals = {};
        (json.data.allQuestionsCount || []).forEach(function (q) { totals[q.difficulty] = q.count; });
        var d = {
            totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0,
            totalQuestions: totals['All'] || 3400, totalEasy: totals['Easy'] || 850,
            totalMedium: totals['Medium'] || 1800, totalHard: totals['Hard'] || 750,
            ranking: mu.profile ? (mu.profile.ranking || '\u2014') : '\u2014',
            reputation: mu.profile ? (mu.profile.reputation || 0) : 0, acceptanceRate: null
        };
        subs.forEach(function (s) {
            if (s.difficulty === 'All') d.totalSolved = s.count;
            if (s.difficulty === 'Easy') d.easySolved = s.count;
            if (s.difficulty === 'Medium') d.mediumSolved = s.count;
            if (s.difficulty === 'Hard') d.hardSolved = s.count;
        });
        if (d.totalSolved === 0 && (d.easySolved + d.mediumSolved + d.hardSolved) > 0)
            d.totalSolved = d.easySolved + d.mediumSolved + d.hardSolved;
        return d;
    }

    // Normalize third-party API response into standard shape
    function normalize(raw) {
        if (!raw || raw.errors || raw.status === 'error' || raw.message === 'user does not exist')
            throw new Error('User not found');
        var solved = raw.totalSolved || raw.solvedProblem || raw.total_solved || 0;
        var easy = raw.easySolved || raw.easy_solved || 0;
        var med = raw.mediumSolved || raw.medium_solved || 0;
        var hard = raw.hardSolved || raw.hard_solved || 0;
        if (raw.submitStatsGlobal && raw.submitStatsGlobal.acSubmissionNum) {
            raw.submitStatsGlobal.acSubmissionNum.forEach(function (s) {
                if (s.difficulty === 'All') solved = s.count;
                if (s.difficulty === 'Easy') easy = s.count;
                if (s.difficulty === 'Medium') med = s.count;
                if (s.difficulty === 'Hard') hard = s.count;
            });
        }
        if (raw.acSubmissionNum && Array.isArray(raw.acSubmissionNum)) {
            raw.acSubmissionNum.forEach(function (s) {
                if (s.difficulty === 'All') solved = s.count;
                if (s.difficulty === 'Easy') easy = s.count;
                if (s.difficulty === 'Medium') med = s.count;
                if (s.difficulty === 'Hard') hard = s.count;
            });
        }
        if (!solved && (easy + med + hard > 0)) solved = easy + med + hard;
        if (!solved) throw new Error('No data');
        return {
            totalSolved: solved, totalQuestions: raw.totalQuestions || 3400,
            easySolved: easy, totalEasy: raw.totalEasy || 850,
            mediumSolved: med, totalMedium: raw.totalMedium || 1800,
            hardSolved: hard, totalHard: raw.totalHard || 750,
            ranking: raw.ranking || '\u2014', acceptanceRate: raw.acceptanceRate || raw.acceptance_rate || null,
            reputation: raw.reputation || 0
        };
    }

    var safeUser = encodeURIComponent(username);

    // All fetch strategies — fired in parallel, first valid result wins
    var strategies = [
        // 1. Direct LeetCode GraphQL (works in Chrome extension context)
        function () {
            return timedFetch('https://leetcode.com/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: gqlBody
            }, 15000).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(parseGQL);
        },
        // 2. LeetCode GraphQL via CORS proxy (works outside extension)
        function () {
            return timedFetch('https://corsproxy.io/?' + encodeURIComponent('https://leetcode.com/graphql'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: gqlBody
            }, 20000).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(parseGQL);
        },
        // 3. alfa-leetcode-api /userProfile/ (Render — may have cold start)
        function () {
            return timedFetch('https://alfa-leetcode-api.onrender.com/userProfile/' + safeUser, {}, 30000)
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(normalize);
        },
        // 4. alfa-leetcode-api /{user}/solved (alternate endpoint)
        function () {
            return timedFetch('https://alfa-leetcode-api.onrender.com/' + safeUser + '/solved', {}, 30000)
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(normalize);
        },
        // 5. leetcode-stats-api (Heroku)
        function () {
            return timedFetch('https://leetcode-stats-api.herokuapp.com/' + safeUser, {}, 15000)
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(normalize);
        }
    ];

    var data = null;

    // Race all strategies — Promise.any resolves with first success
    try {
        data = await Promise.any(strategies.map(function (fn) { return fn(); }));
    } catch (e) {
        // AggregateError: all strategies failed
        data = null;
    }

    if (!data) {
        // Fall back to any cached data even if stale
        if (cached && cached.data) {
            savedLCUser = username;
            localStorage.setItem('lc_user', username);
            renderLeetCode(cached.data, username);
            return;
        }
        $('#lc-setup').innerHTML =
            '<p class="lc-setup-text">Enter your LeetCode username</p>' +
            '<div class="flex-row"><input class="lc-input" id="lc-username" placeholder="e.g. neal_wu" autocomplete="off" value="' + escapeHtml(username) + '"/>' +
            '<button class="btn-lc" id="lc-btn">Load</button></div>' +
            '<div class="lc-error">\u26a0 Could not reach LeetCode. Check username and try again.</div>';
        bindLCForm();
        return;
    }

    // Cache successful data
    try {
        localStorage.setItem(LC_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) { /* ignore */ }

    localStorage.setItem('lc_user', username);
    savedLCUser = username;
    renderLeetCode(data, username);
}

function renderLeetCode(data, username) {
    $('#lc-setup').classList.add('hidden');
    $('#lc-prof').classList.remove('hidden');
    $('#lc-sb').innerHTML = '<div class="badge-y">\u2b21 connected</div>';

    const totalSolved = data.totalSolved || 0;
    const totalQuestions = data.totalQuestions || 3400;
    const easySolved = data.easySolved || 0;
    const easyTotal = data.totalEasy || 850;
    const medSolved = data.mediumSolved || 0;
    const medTotal = data.totalMedium || 1800;
    const hardSolved = data.hardSolved || 0;
    const hardTotal = data.totalHard || 750;
    const ranking = data.ranking || '—';
    const acceptance = data.acceptanceRate ? parseFloat(data.acceptanceRate).toFixed(1) : '—';
    const reputation = data.reputation || 0;

    // Stats
    $('#lc-total').textContent = totalSolved + ' / ' + totalQuestions;
    $('#lc-rank').textContent = ranking !== '—' ? '#' + fmt(ranking) : '—';
    $('#lc-accept').textContent = acceptance !== '—' ? acceptance + '%' : '—';
    $('#lc-rep').textContent = fmt(reputation);

    // Ring
    const circumference = 2 * Math.PI * 46;
    const easyArc = (easySolved / Math.max(easyTotal, 1)) * circumference;
    const medArc = (medSolved / Math.max(medTotal, 1)) * circumference;
    const hardArc = (hardSolved / Math.max(hardTotal, 1)) * circumference;

    // We use stacked ring segments
    const ringEl = $('#lc-ring');
    ringEl.innerHTML =
        '<svg class="lc-ring-svg" viewBox="0 0 110 110">' +
        '<circle class="lc-ring-track" cx="55" cy="55" r="46"/>' +
        '<circle class="lc-ring-easy" cx="55" cy="55" r="46" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + (circumference - easyArc) + '"/>' +
        '</svg>' +
        '<svg class="lc-ring-svg lc-ring-inner-med" viewBox="0 0 110 110">' +
        '<circle class="lc-ring-track" cx="55" cy="55" r="37" stroke-width="4"/>' +
        '<circle class="lc-ring-med" cx="55" cy="55" r="37" stroke-dasharray="' + (2 * Math.PI * 37) + '" stroke-dashoffset="' + ((2 * Math.PI * 37) - (medSolved / Math.max(medTotal, 1)) * (2 * Math.PI * 37)) + '" stroke-width="4"/>' +
        '</svg>' +
        '<svg class="lc-ring-svg lc-ring-inner-hard" viewBox="0 0 110 110">' +
        '<circle class="lc-ring-track" cx="55" cy="55" r="28" stroke-width="3"/>' +
        '<circle class="lc-ring-hard" cx="55" cy="55" r="28" stroke-dasharray="' + (2 * Math.PI * 28) + '" stroke-dashoffset="' + ((2 * Math.PI * 28) - (hardSolved / Math.max(hardTotal, 1)) * (2 * Math.PI * 28)) + '" stroke-width="3"/>' +
        '</svg>';

    $('#lc-ring-total').textContent = totalSolved;

    // Progress bars
    const easyPct = ((easySolved / Math.max(easyTotal, 1)) * 100).toFixed(1);
    const medPct = ((medSolved / Math.max(medTotal, 1)) * 100).toFixed(1);
    const hardPct = ((hardSolved / Math.max(hardTotal, 1)) * 100).toFixed(1);

    $('#lc-easy-count').textContent = easySolved + ' / ' + easyTotal;
    $('#lc-med-count').textContent = medSolved + ' / ' + medTotal;
    $('#lc-hard-count').textContent = hardSolved + ' / ' + hardTotal;

    // Animate bars after a frame
    requestAnimationFrame(() => {
        $('#lc-easy-bar').style.width = easyPct + '%';
        $('#lc-med-bar').style.width = medPct + '%';
        $('#lc-hard-bar').style.width = hardPct + '%';
    });

    $('#lc-user-label').textContent = '@' + username;

    // Reset button
    $('#lc-reset-btn').onclick = resetLeetCode;
}

function resetLeetCode() {
    localStorage.removeItem('lc_user');
    savedLCUser = '';
    $('#lc-prof').classList.add('hidden');
    $('#lc-sb').innerHTML = '';
    $('#lc-setup').innerHTML =
        '<p class="lc-setup-text">Enter your LeetCode username</p>' +
        '<div class="flex-row"><input class="lc-input" id="lc-username" placeholder="e.g. neal_wu" autocomplete="off"/>' +
        '<button class="btn-lc" id="lc-btn">Load</button></div>';
    $('#lc-setup').classList.remove('hidden');
    bindLCForm();
}

/* (Metrics removed — replaced by LeetCode card) */

/* ══════════════════════════════════════════════════════
   6. SYSTEM METRICS (CPU / RAM)
   ══════════════════════════════════════════════════════ */
(function initSystemMetrics() {
    var prevCpuInfo = null;
    var smoothCpu = 0;
    var smoothRam = 0;
    var firstRun = true;

    function setCpu(pct) {
        pct = Math.max(0, Math.min(100, pct));
        if (firstRun) { smoothCpu = pct; } else { smoothCpu += (pct - smoothCpu) * 0.4; }
        var display = Math.round(smoothCpu);
        var el = $('#sb-cpu-pct');
        var bar = $('#sb-cpu-bar');
        if (el) el.textContent = display + '%';
        if (bar) bar.style.width = display + '%';
    }

    function setRam(pct) {
        pct = Math.max(0, Math.min(100, pct));
        if (firstRun) { smoothRam = pct; } else { smoothRam += (pct - smoothRam) * 0.4; }
        var display = Math.round(smoothRam);
        var el = $('#sb-ram-pct');
        var bar = $('#sb-ram-bar');
        if (el) el.textContent = display + '%';
        if (bar) bar.style.width = display + '%';
    }

    var hasChromeMemory = typeof chrome !== 'undefined' && chrome.system && chrome.system.memory;
    var hasChromeCpu = typeof chrome !== 'undefined' && chrome.system && chrome.system.cpu;

    // Track long-task busyness for CPU estimation
    var longTaskMs = 0;
    var longTaskStart = performance.now();
    if (typeof PerformanceObserver !== 'undefined') {
        try {
            var obs = new PerformanceObserver(function (list) {
                list.getEntries().forEach(function (e) { longTaskMs += e.duration; });
            });
            obs.observe({ type: 'longtask', buffered: true });
        } catch (e) { /* observer not supported */ }
    }

    function updateMetrics() {
        // ── RAM ──
        if (hasChromeMemory) {
            chrome.system.memory.getInfo(function (info) {
                if (!info) return;
                setRam(Math.round(((info.capacity - info.availableCapacity) / info.capacity) * 100));
            });
        } else if (performance && performance.memory) {
            // performance.memory gives JS heap — calculate real browser memory pressure
            var used = performance.memory.usedJSHeapSize;
            var limit = performance.memory.jsHeapSizeLimit;
            var total = performance.memory.totalJSHeapSize;
            // Browser typically uses 3-6x more than JS heap alone (DOM, GPU, network buffers)
            var estimatedBrowserMB = (total / 1048576) * 4.5;
            var deviceMB = (navigator.deviceMemory || 8) * 1024;
            // OS + background apps typically use 40-50% of RAM
            var osBaseMB = deviceMB * 0.42;
            var ramPct = Math.round(((osBaseMB + estimatedBrowserMB) / deviceMB) * 100);
            setRam(Math.min(95, Math.max(25, ramPct)));
        } else {
            // No memory API — show N/A
            var el = $('#sb-ram-pct');
            if (el) el.textContent = 'N/A';
        }

        // ── CPU ──
        if (hasChromeCpu) {
            chrome.system.cpu.getInfo(function (info) {
                if (!info) return;
                if (prevCpuInfo) {
                    var totalDiff = 0, idleDiff = 0;
                    info.processors.forEach(function (proc, i) {
                        var prev = prevCpuInfo.processors[i];
                        totalDiff += proc.usage.total - prev.usage.total;
                        idleDiff += proc.usage.idle - prev.usage.idle;
                    });
                    setCpu(totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0);
                }
                prevCpuInfo = info;
            });
        } else {
            // Use long-task observer data + frame timing for CPU estimate
            var now = performance.now();
            var wallTime = now - longTaskStart;
            // Long tasks are >50ms main-thread blocks — they indicate CPU pressure
            var ltRatio = wallTime > 0 ? (longTaskMs / wallTime) : 0;
            longTaskMs = 0;
            longTaskStart = now;

            // Also measure frame jank
            var frameStart = performance.now();
            requestAnimationFrame(function () {
                var frameDur = performance.now() - frameStart;
                // Ideal frame is 16.7ms; higher = busier
                var frameLoad = Math.min((frameDur - 8) / 50, 1);
                if (frameLoad < 0) frameLoad = 0;
                var combined = (ltRatio * 60) + (frameLoad * 25) + 3;
                setCpu(Math.max(1, Math.min(90, Math.round(combined))));
            });
        }

        firstRun = false;
    }

    // Initial + interval
    updateMetrics();
    setInterval(updateMetrics, 2500);
})();

/* (Scratchpad removed — replaced by Pet Dog) */

/* ══════════════════════════════════════════════════════
   9. CARD GLOW EFFECT
   ══════════════════════════════════════════════════════ */
$$('.card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
});

/* ══════════════════════════════════════════════════════
   10. STATUS BAR ANIMATION
   ══════════════════════════════════════════════════════ */
setInterval(() => {
    if (Math.random() > 0.72) {
        const cEl = $('#sb-c');
        cEl.textContent = +cEl.textContent + 1;
    }
}, 9000);

/* ══════════════════════════════════════════════════════
   11. AUTO-LOAD SAVED PROFILES
   ══════════════════════════════════════════════════════ */
if (savedGHUser) loadGitHub(savedGHUser);
if (savedLCUser) loadLeetCode(savedLCUser);

/* ══════════════════════════════════════════════════════
   12. GREETING WITH NAME
   ══════════════════════════════════════════════════════ */
(function initGreeting() {
    const greetEl = $('#greeting');
    const nameEl = $('#greeting-name');
    const STORE_KEY = 'devtab_name';

    function getGreeting() {
        const h = new Date().getHours();
        if (h < 5) return 'Good night';
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        if (h < 21) return 'Good evening';
        return 'Good night';
    }

    function render() {
        const name = localStorage.getItem(STORE_KEY) || 'developer';
        greetEl.textContent = getGreeting() + ',';
        nameEl.textContent = name;
    }

    nameEl.addEventListener('click', () => {
        const current = localStorage.getItem(STORE_KEY) || 'developer';
        const name = prompt('Enter your name:', current);
        if (name !== null && name.trim()) {
            localStorage.setItem(STORE_KEY, name.trim());
            render();
        }
    });

    render();
    setInterval(render, 60000);
})();

/* ══════════════════════════════════════════════════════
   13. WEATHER WIDGET (Open-Meteo — no API key)
   ══════════════════════════════════════════════════════ */
(function initWeather() {
    const WMO_ICONS = {
        0: '\u2600\ufe0f', 1: '\ud83c\udf24\ufe0f', 2: '\u26c5', 3: '\u2601\ufe0f',
        45: '\ud83c\udf2b\ufe0f', 48: '\ud83c\udf2b\ufe0f',
        51: '\ud83c\udf26\ufe0f', 53: '\ud83c\udf26\ufe0f', 55: '\ud83c\udf27\ufe0f',
        56: '\ud83c\udf28\ufe0f', 57: '\ud83c\udf28\ufe0f',
        61: '\ud83c\udf27\ufe0f', 63: '\ud83c\udf27\ufe0f', 65: '\ud83c\udf27\ufe0f',
        66: '\ud83c\udf28\ufe0f', 67: '\ud83c\udf28\ufe0f',
        71: '\ud83c\udf28\ufe0f', 73: '\u2744\ufe0f', 75: '\u2744\ufe0f', 77: '\u2744\ufe0f',
        80: '\ud83c\udf26\ufe0f', 81: '\ud83c\udf27\ufe0f', 82: '\u26c8\ufe0f',
        85: '\ud83c\udf28\ufe0f', 86: '\ud83c\udf28\ufe0f',
        95: '\u26a1', 96: '\u26a1', 99: '\u26a1'
    };

    const WMO_DESC = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Depositing rime fog',
        51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
        56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
        61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        66: 'Light freezing rain', 67: 'Heavy freezing rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
        80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
        85: 'Slight snow showers', 86: 'Heavy snow showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
    };

    const LOC_KEY = 'devtab_weather_loc';

    function setUI(icon, temp, desc, feels, humid, wind, uv, city) {
        var el;
        if ((el = $('#weather-icon'))) el.textContent = icon;
        if ((el = $('#weather-temp'))) el.textContent = Math.round(temp) + '\u00b0C';
        if ((el = $('#weather-desc'))) el.textContent = desc;
        if ((el = $('#w-feels'))) el.textContent = Math.round(feels) + '\u00b0';
        if ((el = $('#w-humid'))) el.textContent = humid + '%';
        if ((el = $('#w-wind'))) el.textContent = wind + ' km/h';
        if ((el = $('#w-uv'))) el.textContent = uv;
        if ((el = $('#weather-loc'))) el.textContent = city;
    }

    async function fetchWeather(lat, lon, city) {
        try {
            const res = await fetch(
                'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
                '&longitude=' + lon +
                '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index' +
                '&timezone=auto'
            );
            if (!res.ok) throw new Error('Weather API error');
            const data = await res.json();
            const c = data.current;
            const code = c.weather_code;
            setUI(
                WMO_ICONS[code] || '\u2601\ufe0f',
                c.temperature_2m,
                WMO_DESC[code] || 'Unknown',
                c.apparent_temperature,
                c.relative_humidity_2m,
                Math.round(c.wind_speed_10m),
                c.uv_index !== undefined ? c.uv_index.toFixed(1) : '--',
                city
            );
            localStorage.setItem(LOC_KEY, JSON.stringify({ lat: lat, lon: lon, city: city }));
        } catch (e) {
            if ($('#weather-desc')) $('#weather-desc').textContent = 'Failed to load';
        }
    }

    // Try cached location first for instant display, then refresh
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(LOC_KEY)); } catch (e) { /* ignore */ }

    if (cached && cached.lat) {
        fetchWeather(cached.lat, cached.lon, cached.city || 'Saved location');
    }

    // Request geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async function (pos) {
                var lat = pos.coords.latitude.toFixed(4);
                var lon = pos.coords.longitude.toFixed(4);
                // Reverse geocode city name from Open-Meteo geocoding
                var city = 'Your location';
                try {
                    var geoRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m&timezone=auto');
                    if (geoRes.ok) {
                        var geoData = await geoRes.json();
                        city = geoData.timezone ? geoData.timezone.split('/').pop().replace(/_/g, ' ') : city;
                    }
                } catch (e) { /* keep default */ }
                fetchWeather(lat, lon, city);
            },
            function () {
                // Geolocation denied — use ip-based fallback or show message
                if (!cached) {
                    if ($('#weather-desc')) $('#weather-desc').textContent = 'Allow location access';
                    if ($('#weather-icon')) $('#weather-icon').textContent = '\ud83d\udccd';
                }
            },
            { timeout: 8000 }
        );
    }

    // Refresh every 15 minutes
    setInterval(function () {
        var loc = null;
        try { loc = JSON.parse(localStorage.getItem(LOC_KEY)); } catch (e) { /* ignore */ }
        if (loc && loc.lat) fetchWeather(loc.lat, loc.lon, loc.city || '--');
    }, 900000);
})();

/* ══════════════════════════════════════════════════════
   14. WAKATIME CODING STATS
   ══════════════════════════════════════════════════════ */
(function initWakaTime() {
    var savedKey = localStorage.getItem('devtab_waka_key') || '';

    // Multiple CORS proxies as fallbacks
    var CORS_PROXIES = [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/'
    ];

    function bindWakaForm() {
        var btn = $('#waka-btn');
        var inp = $('#waka-key');
        if (!btn || !inp) return;
        var go = function () { var v = inp.value.trim(); if (v) loadWaka(v); };
        btn.onclick = go;
        inp.onkeydown = function (e) { if (e.key === 'Enter') go(); };
    }
    bindWakaForm();

    function fmtDuration(totalSec) {
        var h = Math.floor(totalSec / 3600);
        var m = Math.floor((totalSec % 3600) / 60);
        return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    }

    var WAKA_LANG_COLORS = {
        JavaScript: '#f1e05a', TypeScript: '#2b7489', Python: '#3572A5', Java: '#b07219',
        'C++': '#f34b7d', C: '#555555', Rust: '#dea584', Go: '#00ADD8', Ruby: '#701516',
        HTML: '#e34c26', CSS: '#563d7c', JSON: '#8b949e', Markdown: '#083fa1',
        Bash: '#89e051', Shell: '#89e051', PHP: '#4F5D95', Swift: '#ffac45', Kotlin: '#F18E33',
        default: '#8b949e'
    };

    async function loadWaka(apiKey) {
        $('#waka-setup').innerHTML = '<div class="ls"><div class="spinner"></div><span>fetching stats\u2026</span></div>';

        try {
            var token = btoa(apiKey);

            // Fetch summaries for last 7 days
            var today = new Date();
            var weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 6);
            var startStr = weekAgo.toISOString().split('T')[0];
            var endStr = today.toISOString().split('T')[0];

            var summaryUrl = 'https://wakatime.com/api/v1/users/current/summaries?start=' + startStr + '&end=' + endStr;

            var data = null;
            var lastErr = null;

            // Try each CORS proxy
            for (var i = 0; i < CORS_PROXIES.length; i++) {
                try {
                    var proxyUrl = CORS_PROXIES[i] + encodeURIComponent(summaryUrl);
                    var controller = new AbortController();
                    var timeout = setTimeout(function () { controller.abort(); }, 12000);
                    var res = await fetch(proxyUrl, {
                        headers: { 'Authorization': 'Basic ' + token },
                        signal: controller.signal
                    });
                    clearTimeout(timeout);

                    if (res.status === 401 || res.status === 403) throw new Error('Invalid API key');
                    if (!res.ok) { lastErr = new Error('Proxy ' + (i + 1) + ' error (' + res.status + ')'); continue; }

                    data = await res.json();
                    if (data.data && data.data.length) break;
                    lastErr = new Error('No data returned');
                    data = null;
                } catch (e) {
                    clearTimeout(timeout);
                    if (e.message === 'Invalid API key') throw e;
                    lastErr = e.name === 'AbortError' ? new Error('Request timed out') : e;
                }
            }

            if (!data || !data.data || !data.data.length) {
                throw lastErr || new Error('All proxies failed. WakaTime may be blocking requests.');
            }

            localStorage.setItem('devtab_waka_key', apiKey);
            savedKey = apiKey;
            renderWaka(data.data);
        } catch (err) {
            $('#waka-setup').innerHTML =
                '<p class="waka-setup-text">Enter your WakaTime API key<br><span class="waka-hint">Settings \u2192 API Key on wakatime.com</span></p>' +
                '<div class="flex-row"><input class="waka-input" id="waka-key" type="password" placeholder="waka_xxxx\u2026" autocomplete="off"/>' +
                '<button class="btn-waka" id="waka-btn">Load</button></div>' +
                '<div class="waka-error">\u26a0 ' + escapeHtml(err.message) + '</div>';
            bindWakaForm();
        }
    }

    function renderWaka(days) {
        $('#waka-setup').classList.add('hidden');
        $('#waka-prof').classList.remove('hidden');
        $('#waka-sb').innerHTML = '<div class="badge-g">\u2b21 connected</div>';

        // Today's total
        var todayData = days[days.length - 1];
        var todaySec = todayData.grand_total ? todayData.grand_total.total_seconds : 0;
        $('#waka-today-time').textContent = fmtDuration(todaySec);

        // Circular ring for today (goal: 8 hours)
        var GOAL_SEC = 8 * 3600;
        var ringPct = Math.min(todaySec / GOAL_SEC, 1);
        var circumference = 2 * Math.PI * 52; // r=52
        var ringEl = $('#waka-ring-fill');
        if (ringEl) {
            requestAnimationFrame(function () {
                ringEl.style.strokeDashoffset = circumference - (ringPct * circumference);
            });
        }

        // Week total
        var weekTotalSec = days.reduce(function (sum, d) {
            return sum + (d.grand_total ? d.grand_total.total_seconds : 0);
        }, 0);
        var wkEl = $('#waka-week-total');
        if (wkEl) {
            var wh = Math.floor(weekTotalSec / 3600);
            var wm = Math.floor((weekTotalSec % 3600) / 60);
            wkEl.textContent = wh > 0 ? wh + 'h ' + wm + 'm' : wm + 'm';
        }

        // Weekly bars
        var maxSec = Math.max.apply(null, days.map(function (d) {
            return d.grand_total ? d.grand_total.total_seconds : 0;
        }));
        if (maxSec === 0) maxSec = 1;

        var barsEl = $('#waka-bars');
        barsEl.innerHTML = '';
        var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var BAR_CLASSES = [
            'waka-bar-sun',
            'waka-bar-mon',
            'waka-bar-tue',
            'waka-bar-wed',
            'waka-bar-thu',
            'waka-bar-fri',
            'waka-bar-sat'
        ];
        days.forEach(function (d) {
            var sec = d.grand_total ? d.grand_total.total_seconds : 0;
            var pct = ((sec / maxSec) * 100).toFixed(1);
            var dateObj = new Date(d.range.date + 'T12:00:00');
            var dayName = DAY_NAMES[dateObj.getDay()];
            var barClass = BAR_CLASSES[dateObj.getDay()];
            var barInner = sec > 0
                ? '<div class="waka-bar-fill ' + barClass + '" style="width:' + pct + '%"></div>'
                : '';
            barsEl.innerHTML +=
                '<div class="waka-bar-row">' +
                '<span class="waka-bar-day">' + dayName + '</span>' +
                '<div class="waka-bar-track">' + barInner + '</div>' +
                '<span class="waka-bar-time">' + fmtDuration(sec) + '</span>' +
                '</div>';
        });

        // Languages (aggregate across the week)
        var langMap = {};
        days.forEach(function (d) {
            if (d.languages) {
                d.languages.forEach(function (l) {
                    langMap[l.name] = (langMap[l.name] || 0) + l.total_seconds;
                });
            }
        });
        var sorted = Object.entries(langMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
        var totalLangSec = sorted.reduce(function (s, e) { return s + e[1]; }, 0);

        var langsEl = $('#waka-langs');
        langsEl.innerHTML = '';
        sorted.forEach(function (entry) {
            var name = entry[0], sec = entry[1];
            var pct = totalLangSec > 0 ? ((sec / totalLangSec) * 100).toFixed(0) : 0;
            var col = WAKA_LANG_COLORS[name] || WAKA_LANG_COLORS.default;
            langsEl.innerHTML +=
                '<div class="waka-lang-row">' +
                '<span class="waka-lang-dot" style="background:' + col + '; color:' + col + '"></span>' +
                '<span class="waka-lang-name">' + escapeHtml(name) + '</span>' +
                '<div class="waka-lang-bar-wrap"><div class="waka-lang-bar-fill" style="width:' + pct + '%; background:' + col + '"></div></div>' +
                '<span class="waka-lang-pct">' + pct + '%</span>' +
                '</div>';
        });

        $('#waka-reset-btn').onclick = resetWaka;
    }

    function resetWaka() {
        localStorage.removeItem('devtab_waka_key');
        savedKey = '';
        $('#waka-prof').classList.add('hidden');
        $('#waka-sb').innerHTML = '';
        $('#waka-setup').innerHTML =
            '<p class="waka-setup-text">Enter your WakaTime API key<br><span class="waka-hint">Settings \u2192 API Key on wakatime.com</span></p>' +
            '<div class="flex-row"><input class="waka-input" id="waka-key" type="password" placeholder="waka_xxxx\u2026" autocomplete="off"/>' +
            '<button class="btn-waka" id="waka-btn">Load</button></div>';
        $('#waka-setup').classList.remove('hidden');
        bindWakaForm();
    }

    if (savedKey) loadWaka(savedKey);
})();

/* ══════════════════════════════════════════════════════
   15. CHRONO CARD — Stopwatch / Timer
   ══════════════════════════════════════════════════════ */
(function initChrono() {
    /* ── Tab Switching ── */
    var tabs = document.querySelectorAll('.chrono-tab');
    var panels = document.querySelectorAll('.chrono-panel');

    tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            var target = tab.getAttribute('data-tab');
            tabs.forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            panels.forEach(function(p) {
                p.classList.toggle('hidden', p.id !== 'panel-' + target);
            });
        });
    });

    /* ── Stopwatch Tick Marks ── */
    (function drawSwTicks() {
        var ticksG = document.getElementById('sw-ticks');
        if (!ticksG) return;
        for (var i = 0; i < 60; i++) {
            var angle = (i * 6) * Math.PI / 180;
            var isMain = i % 5 === 0;
            var r1 = isMain ? 54 : 57;
            var r2 = 60;
            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 70 + r1 * Math.sin(angle));
            line.setAttribute('y1', 70 - r1 * Math.cos(angle));
            line.setAttribute('x2', 70 + r2 * Math.sin(angle));
            line.setAttribute('y2', 70 - r2 * Math.cos(angle));
            line.setAttribute('stroke', isMain ? 'rgba(34,211,160,0.4)' : 'rgba(139,157,195,0.15)');
            line.setAttribute('stroke-width', isMain ? '1.5' : '0.5');
            line.setAttribute('stroke-linecap', 'round');
            ticksG.appendChild(line);
        }
    })();

    /* ── Stopwatch ── */
    (function initStopwatch() {
        var display = document.getElementById('sw-display');
        var startBtn = document.getElementById('sw-start');
        var lapBtn = document.getElementById('sw-lap');
        var resetBtn = document.getElementById('sw-reset');
        var lapsEl = document.getElementById('sw-laps');
        var ringFill = document.getElementById('sw-ring-fill');
        if (!display || !startBtn) return;

        var running = false;
        var startTime = 0;
        var elapsed = 0;
        var rafId = null;
        var laps = [];
        var lastLapTime = 0;
        var swCirc = 2 * Math.PI * 60; // 376.99

        function fmtSW(ms) {
            var totalSec = Math.floor(ms / 1000);
            var mins = Math.floor(totalSec / 60);
            var secs = totalSec % 60;
            var centis = Math.floor((ms % 1000) / 10);
            return pad(mins) + ':' + pad(secs) + '<span class="sw-ms">.' + pad(centis) + '</span>';
        }

        function updateSwRing() {
            // Fill based on seconds within current minute (0-60)
            var secInMin = (elapsed / 1000) % 60;
            var pct = secInMin / 60;
            if (ringFill) {
                ringFill.style.strokeDashoffset = swCirc * (1 - pct);
            }
        }

        function tick() {
            if (!running) return;
            elapsed = Date.now() - startTime;
            display.innerHTML = fmtSW(elapsed);
            updateSwRing();
            rafId = requestAnimationFrame(tick);
        }

        startBtn.addEventListener('click', function() {
            if (running) {
                running = false;
                cancelAnimationFrame(rafId);
                startBtn.innerHTML = '&#9654; Start';
                startBtn.classList.remove('running');
            } else {
                running = true;
                startTime = Date.now() - elapsed;
                startBtn.innerHTML = '&#9632; Stop';
                startBtn.classList.add('running');
                lapBtn.disabled = false;
                resetBtn.disabled = false;
                tick();
            }
        });

        lapBtn.addEventListener('click', function() {
            if (!running) return;
            var lapTime = elapsed;
            var diff = lapTime - lastLapTime;
            lastLapTime = lapTime;
            laps.unshift({ num: laps.length + 1, time: lapTime, diff: diff });
            renderLaps();
        });

        resetBtn.addEventListener('click', function() {
            running = false;
            cancelAnimationFrame(rafId);
            elapsed = 0;
            lastLapTime = 0;
            laps = [];
            display.innerHTML = fmtSW(0);
            startBtn.innerHTML = '&#9654; Start';
            startBtn.classList.remove('running');
            lapBtn.disabled = true;
            resetBtn.disabled = true;
            lapsEl.innerHTML = '';
            if (ringFill) ringFill.style.strokeDashoffset = swCirc;
        });

        function renderLaps() {
            var html = '';
            laps.forEach(function(lap) {
                html += '<div class="sw-lap-item">' +
                    '<span class="sw-lap-num">Lap ' + lap.num + '</span>' +
                    '<span class="sw-lap-diff">+' + (lap.diff / 1000).toFixed(2) + 's</span>' +
                    '<span class="sw-lap-time">' + pad(Math.floor(lap.time / 60000)) + ':' +
                    pad(Math.floor((lap.time % 60000) / 1000)) + '.' +
                    pad(Math.floor((lap.time % 1000) / 10)) + '</span></div>';
            });
            lapsEl.innerHTML = html;
        }
    })();

    /* ── Timer ── */
    (function initTimer() {
        var timerDisplay = document.getElementById('timer-display');
        var timerLabel = document.getElementById('timer-label');
        var timerStartBtn = document.getElementById('timer-start');
        var timerResetBtn = document.getElementById('timer-reset');
        var timerRingFill = document.getElementById('timer-ring-fill');
        var presets = document.querySelectorAll('.timer-preset');
        if (!timerDisplay || !timerStartBtn) return;

        var timerDuration = 300;
        var timerRemaining = 300;
        var timerRunning = false;
        var timerInterval = null;
        var circumference = 2 * Math.PI * 60; // 376.99

        function fmtTimer(sec) {
            var m = Math.floor(sec / 60);
            var s = sec % 60;
            return pad(m) + ':' + pad(s);
        }

        function updateRing() {
            var pct = timerDuration > 0 ? timerRemaining / timerDuration : 0;
            timerRingFill.style.strokeDashoffset = circumference * (1 - pct);

            timerRingFill.classList.remove('warning', 'danger');
            if (pct < 0.15 && pct > 0) {
                timerRingFill.classList.add('danger');
            } else if (pct < 0.3) {
                timerRingFill.classList.add('warning');
            }
        }

        function timerTick() {
            if (timerRemaining <= 0) {
                clearInterval(timerInterval);
                timerRunning = false;
                timerDisplay.textContent = '00:00';
                timerLabel.textContent = 'done!';
                timerStartBtn.innerHTML = '&#9654; Start';
                timerStartBtn.classList.remove('running');
                timerRingFill.style.strokeDashoffset = circumference;
                timerRingFill.classList.remove('warning', 'danger');

                var card = document.querySelector('.chrono-card');
                if (card) {
                    card.classList.add('timer-done-flash');
                    setTimeout(function() { card.classList.remove('timer-done-flash'); }, 1600);
                }
                return;
            }
            timerRemaining--;
            timerDisplay.textContent = fmtTimer(timerRemaining);
            timerLabel.textContent = 'remaining';
            updateRing();
        }

        timerStartBtn.addEventListener('click', function() {
            if (timerRunning) {
                clearInterval(timerInterval);
                timerRunning = false;
                timerStartBtn.innerHTML = '&#9654; Resume';
                timerStartBtn.classList.remove('running');
                timerLabel.textContent = 'paused';
            } else {
                if (timerRemaining <= 0) {
                    timerRemaining = timerDuration;
                }
                timerRunning = true;
                timerStartBtn.innerHTML = '&#10074;&#10074; Pause';
                timerStartBtn.classList.add('running');
                timerLabel.textContent = 'remaining';
                timerInterval = setInterval(timerTick, 1000);
            }
        });

        timerResetBtn.addEventListener('click', function() {
            clearInterval(timerInterval);
            timerRunning = false;
            timerRemaining = timerDuration;
            timerDisplay.textContent = fmtTimer(timerDuration);
            timerLabel.textContent = 'set time';
            timerStartBtn.innerHTML = '&#9654; Start';
            timerStartBtn.classList.remove('running');
            timerRingFill.style.strokeDashoffset = 0;
            timerRingFill.classList.remove('warning', 'danger');
        });

        presets.forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (timerRunning) return;
                presets.forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                timerDuration = parseInt(btn.getAttribute('data-sec'), 10);
                timerRemaining = timerDuration;
                timerDisplay.textContent = fmtTimer(timerDuration);
                timerLabel.textContent = 'set time';
                timerRingFill.style.strokeDashoffset = 0;
                timerRingFill.classList.remove('warning', 'danger');
            });
        });

        timerDisplay.textContent = fmtTimer(timerDuration);
        updateRing();
    })();
})();
