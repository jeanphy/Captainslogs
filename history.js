import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot 
} from "firebase/firestore";
import firebaseConfig from "./firebase-config.js";
import { 
    initStarfield, 
    initStardate, 
    initParallax, 
    initCursorGlow, 
    initSilkRise,
    setWarping 
} from "./celestial-core.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Current view state
let currentView = 'feed';
let cachedDocs = [];

document.addEventListener('DOMContentLoaded', () => {
    setWarping(false);
    initStardate();
    initStarfield();
    initSilkRise();
    initParallax();
    initCursorGlow();
    initHistoryLogic();
});

// ─── INIT ──────────────────────────────────────────────────────────────────────

function initHistoryLogic() {
    const logoutBtn = document.getElementById('logout-btn');
    const feedBtn = document.getElementById('view-feed');
    const dayBtn = document.getElementById('view-day');
    const weekBtn = document.getElementById('view-week');

    if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));

    if (feedBtn) feedBtn.addEventListener('click', () => switchView('feed'));
    if (dayBtn) dayBtn.addEventListener('click', () => switchView('day'));
    if (weekBtn) weekBtn.addEventListener('click', () => switchView('week'));

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadUserLogs(user.uid);
        }
    });
}

function switchView(view) {
    currentView = view;
    setActiveViewBtn(`view-${view}`);
    renderView();
}

function setActiveViewBtn(activeId) {
    // Remove week's disabled styling if clicking it
    const weekBtn = document.getElementById('view-week');
    if (weekBtn) weekBtn.classList.remove('opacity-40', 'cursor-not-allowed');

    ['view-feed', 'view-day', 'view-week'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (id === activeId) {
            btn.classList.add('bg-primary-container', 'text-primary');
            btn.classList.remove('text-on-surface-variant');
        } else {
            btn.classList.remove('bg-primary-container', 'text-primary');
            btn.classList.add('text-on-surface-variant');
        }
    });
}

// ─── DATA LOADING ─────────────────────────────────────────────────────────────

function loadUserLogs(uid) {
    const logsQuery = query(
        collection(db, "logs"),
        where("uid", "==", uid)
    );

    onSnapshot(logsQuery, (snapshot) => {
        // Sort real entries newest first
        cachedDocs = snapshot.docs.map(doc => doc.data()).sort((a, b) => {
            const ta = a.timestamp?.seconds ?? 0;
            const tb = b.timestamp?.seconds ?? 0;
            return tb - ta;
        });

        renderView();
    }, (error) => {
        console.error("History Fetch Error:", error);
        document.getElementById('logs-container').innerHTML = `
            <div class="py-12 px-6 bg-surface-container-low border border-error/20 rounded-3xl text-center">
                <p class="text-error opacity-80 font-medium">Archive retrieval blocked.</p>
                <p class="text-xs text-on-surface-variant mt-2">Check Firestore console for missing composite index link.</p>
            </div>
        `;
    });
}

// ─── RENDER ROUTER ────────────────────────────────────────────────────────────

function renderView() {
    if (cachedDocs.length === 0) {
        document.getElementById('logs-container').innerHTML = `
            <div class="py-20 text-center opacity-40">
                <span class="material-symbols-outlined text-5xl mb-4">folder_open</span>
                <p class="text-sm tracking-widest uppercase">The archive is empty. Begin your journey.</p>
            </div>
        `;
        return;
    }
    if (currentView === 'feed') renderFeedView();
    else if (currentView === 'day') renderDayView();
    else if (currentView === 'week') renderWeekView();
}

// ─── FEED VIEW ────────────────────────────────────────────────────────────────

function renderFeedView() {
    const container = document.getElementById('logs-container');
    container.className = 'space-y-6';
    container.innerHTML = '';
    cachedDocs.forEach((data, i) => container.appendChild(createLogCard(data, i)));
}

// ─── DAY VIEW ─────────────────────────────────────────────────────────────────

function renderDayView() {
    const container = document.getElementById('logs-container');
    container.className = 'space-y-10';
    container.innerHTML = '';

    const groups = groupByKey(data => {
        const ts = getTimestamp(data);
        return ts.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    });

    let globalIndex = 0;
    Object.entries(groups).forEach(([label, entries]) => {
        container.appendChild(buildGroup(label, `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`, entries, (data, i) => createDayCard(data, globalIndex++)));
    });
}

// ─── WEEK VIEW ────────────────────────────────────────────────────────────────

function renderWeekView() {
    const container = document.getElementById('logs-container');
    container.className = 'space-y-12';
    container.innerHTML = '';

    const groups = groupByKey(data => {
        const ts = getTimestamp(data);
        // Get Monday of that week
        const monday = new Date(ts);
        const day = monday.getDay();
        const diff = (day === 0 ? -6 : 1 - day); // Adjust so Mon = start
        monday.setDate(monday.getDate() + diff);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const isCurrentWeek = isThisWeek(ts);
        const label = isCurrentWeek
            ? `This Week · ${fmt(monday)} – ${fmt(sunday)}`
            : `${fmt(monday)} – ${fmt(sunday)}, ${monday.getFullYear()}`;

        // Use the monday ISO string as the sort key so groups stay ordered
        return `${monday.toISOString()}__${label}`;
    });

    // Sort week groups by date descending
    const sortedWeeks = Object.entries(groups).sort((a, b) => {
        const da = new Date(a[0].split('__')[0]);
        const db_ = new Date(b[0].split('__')[0]);
        return db_ - da;
    });

    sortedWeeks.forEach(([key, entries]) => {
        const label = key.split('__')[1];
        const totalWords = entries.reduce((acc, d) => acc + (d.content?.split(' ').length ?? 0), 0);
        const subtitle = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ~${totalWords} words`;
        container.appendChild(buildWeekGroup(label, subtitle, entries));
    });
}

function isThisWeek(date) {
    const now = new Date();
    const monday = new Date(now);
    const day = monday.getDay();
    monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return date >= monday && date <= sunday;
}

// ─── GROUP BUILDER HELPERS ────────────────────────────────────────────────────

function groupByKey(keyFn) {
    const groups = {};
    cachedDocs.forEach(data => {
        const key = keyFn(data);
        if (!groups[key]) groups[key] = [];
        groups[key].push(data);
    });
    return groups;
}

function buildGroup(label, subtitle, entries, cardFn) {
    const group = document.createElement('div');
    group.className = 'space-y-4';
    group.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent"></div>
            <span class="text-xs font-bold tracking-[0.2em] text-primary/60 uppercase whitespace-nowrap">${label}</span>
            <div class="h-px flex-1 bg-gradient-to-l from-primary/20 to-transparent"></div>
        </div>
        <p class="text-[10px] text-on-surface-variant/40 tracking-widest uppercase text-center -mt-2">${subtitle}</p>
    `;
    entries.forEach((data, i) => group.appendChild(cardFn(data, i)));
    return group;
}

function buildWeekGroup(label, subtitle, entries) {
    const group = document.createElement('div');
    group.className = 'space-y-4';

    // Week header with export button
    const header = document.createElement('div');
    header.className = 'glass-panel border border-primary/10 rounded-2xl px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4';
    header.innerHTML = `
        <div>
            <h3 class="text-base font-extrabold text-primary tracking-tight">${label}</h3>
            <p class="text-[10px] text-on-surface-variant/50 tracking-widest uppercase mt-0.5">${subtitle}</p>
        </div>
        <button class="export-btn flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/20 text-primary/70 hover:text-primary hover:bg-primary/10 hover:border-primary/40 transition-all duration-200 text-xs font-bold tracking-widest uppercase group">
            <span class="material-symbols-outlined text-base group-hover:translate-y-0.5 transition-transform">download</span>
            Export PDF
        </button>
    `;

    // Wire up export button
    header.querySelector('.export-btn').addEventListener('click', () => {
        exportWeekToPDF(label, entries);
    });

    group.appendChild(header);

    // Group by day within the week
    const dayGroups = {};
    entries.forEach(data => {
        const ts = getTimestamp(data);
        const dayKey = ts.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
        dayGroups[dayKey].push(data);
    });

    Object.entries(dayGroups).forEach(([day, dayEntries]) => {
        const dayBlock = document.createElement('div');
        dayBlock.className = 'ml-4 pl-4 border-l border-primary/10 space-y-3';

        // Day sub-header
        const dayLabel = document.createElement('p');
        dayLabel.className = 'text-[10px] font-bold tracking-[0.2em] text-on-surface-variant/50 uppercase pt-2';
        dayLabel.textContent = day;
        dayBlock.appendChild(dayLabel);

        dayEntries.forEach((data, i) => dayBlock.appendChild(createDayCard(data, i)));
        group.appendChild(dayBlock);
    });

    return group;
}

// ─── SANITIZATION ─────────────────────────────────────────────────────────────

/**
 * Escapes user-supplied strings before inserting into innerHTML.
 * Uses the browser's own text node to neutralize any HTML tags.
 */
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

function getTimestamp(data) {
    return data.clientDate 
        ? new Date(data.clientDate) 
        : (data.timestamp ? new Date(data.timestamp.seconds * 1000) : new Date());
}

// ─── CARD RENDERERS ───────────────────────────────────────────────────────────

function createLogCard(data, index = 0) {
    const div = document.createElement('div');
    const bg = index % 2 === 0 ? 'bg-surface-container-low' : 'bg-surface-container-high';
    div.className = `skew-card group relative ${bg} hover:brightness-110 transition-all duration-300 shadow-[0_32px_48px_-12px_rgba(0,0,0,0.4)] border border-outline-variant/10 overflow-hidden`;
    
    const ts = getTimestamp(data);
    const dateStr = ts.toLocaleDateString();
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const safeStardate = escapeHTML(data.stardate || '---');
    const safeContent = escapeHTML(data.content);

    div.innerHTML = `
        <div class="skew-inner p-8">
            <div class="flex items-center gap-3 mb-4">
                <span class="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Stardate ${safeStardate}</span>
                <span class="text-xs text-on-surface-variant/40 font-medium">${dateStr} · ${timeStr}</span>
                ${data.isFake ? '<span class="text-[9px] text-tertiary/40 uppercase tracking-widest ml-auto">sample</span>' : ''}
            </div>
            <p class="text-on-surface font-body text-lg leading-relaxed whitespace-pre-wrap">${safeContent}</p>
        </div>
    `;
    return div;
}

function createDayCard(data, index = 0) {
    const div = document.createElement('div');
    const bg = index % 2 === 0 ? 'bg-surface-container-low' : 'bg-surface-container-high';
    div.className = `skew-card group relative ${bg} hover:brightness-110 transition-all duration-300 shadow-[0_32px_48px_-12px_rgba(0,0,0,0.4)] border border-outline-variant/10 overflow-hidden`;
    
    const ts = getTimestamp(data);
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const safeStardate = escapeHTML(data.stardate || '---');
    const safeContent = escapeHTML(data.content);

    div.innerHTML = `
        <div class="skew-inner px-8 py-6 flex gap-6 items-start">
            <div class="shrink-0 text-right min-w-[52px]">
                <span class="text-xs font-bold text-primary/80 tabular-nums">${timeStr}</span>
            </div>
            <div class="flex-1 border-l border-outline-variant/10 pl-6">
                <span class="text-[10px] font-bold tracking-[0.2em] text-primary/50 uppercase block mb-2">Stardate ${safeStardate}</span>
                <p class="text-on-surface font-body text-base leading-relaxed whitespace-pre-wrap">${safeContent}</p>
                ${data.isFake ? '<span class="text-[9px] text-tertiary/40 uppercase tracking-widest mt-2 block">sample</span>' : ''}
            </div>
        </div>
    `;
    return div;
}

function exportWeekToPDF(weekLabel, entries) {
    const sorted = [...entries].sort((a, b) => getTimestamp(a).getTime() - getTimestamp(b).getTime());

    // Group by day
    const dayGroups = {};
    sorted.forEach(data => {
        const ts = getTimestamp(data);
        const dayKey = ts.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
        dayGroups[dayKey].push(data);
    });

    const entriesHTML = Object.entries(dayGroups).map(([day, dayEntries]) => `
        <div class="day-group">
            <h3>${day}</h3>
            ${dayEntries.map(data => {
                const ts = getTimestamp(data);
                const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `<div class="entry">
                    <div class="entry-meta">
                        <span class="stardate">Stardate ${escapeHTML(data.stardate || '---')}</span>
                        <span class="time">${timeStr}</span>
                    </div>
                    <p>${escapeHTML(data.content || '').replace(/\n/g, '<br/>')}</p>
                </div>`;
            }).join('')}
        </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Captain's Log · ${weekLabel}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Manrope',sans-serif;color:#1a1a2e;background:#fff;padding:48px;max-width:720px;margin:0 auto}
header{border-bottom:2px solid #e0d9f7;padding-bottom:20px;margin-bottom:36px}
header h1{font-size:13px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#634db5;margin-bottom:4px}
header h2{font-size:22px;font-weight:800;color:#1a1a2e;letter-spacing:-.02em}
header p{font-size:11px;color:#948f99;margin-top:4px;text-transform:uppercase;letter-spacing:.15em}
.day-group{margin-bottom:36px}
.day-group h3{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#634db5;border-bottom:1px solid #e7deff;padding-bottom:8px;margin-bottom:16px}
.entry{margin-bottom:20px;padding-left:16px;border-left:2px solid #e7deff}
.entry-meta{display:flex;gap:12px;margin-bottom:8px}
.stardate{font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#634db5}
.time{font-size:10px;color:#948f99;font-weight:600}
p{font-size:14px;line-height:1.8;color:#231d2e;font-weight:300}
footer{margin-top:48px;padding-top:16px;border-top:1px solid #e7deff;font-size:10px;color:#948f99;text-align:center;letter-spacing:.15em;text-transform:uppercase}
@media print{.day-group{page-break-inside:avoid}.entry{page-break-inside:avoid}}
</style></head>
<body>
<header>
    <h1>Captain's Log · Archive</h1>
    <h2>${weekLabel}</h2>
    <p>${sorted.length} ${sorted.length === 1 ? 'entry' : 'entries'} · Exported ${new Date().toLocaleDateString()}</p>
</header>
${entriesHTML}
<footer>The Sanctuary · Captain's Log · Private Archive</footer>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;

    // Blob URL — never blocked by popup blockers
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}
