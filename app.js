let allVideos = [];
let currentDate = new Date();
let currentView = 'week';

document.addEventListener("DOMContentLoaded", () => {
    initUI();
    fetchSchedule();
});

function initUI() {
    bindClick("btn-week", () => switchView('week'));
    bindClick("btn-month", () => switchView('month'));
    bindClick("btn-week-m", () => switchView('week'));
    bindClick("btn-month-m", () => switchView('month'));

    bindClick("prev-btn", () => navigateDate(-1));
    bindClick("next-btn", () => navigateDate(1));
    bindClick("today-btn", () => { currentDate = new Date(); render(); });

    bindClick("prev-btn-m", () => navigateDate(-1));
    bindClick("next-btn-m", () => navigateDate(1));
    bindClick("today-btn-m", () => { currentDate = new Date(); render(); });

    bindClick("modal-close", closeModal);
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target.id === "modal-overlay") closeModal();
        });
    }

    initMemoApp();
}

function bindClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
}

async function fetchSchedule() {
    try {
        const response = await fetch("data/schedule.json?" + new Date().getTime());
        if (!response.ok) throw new Error("Load failed");
        const data = await response.json();
        allVideos = data.videos || [];
        render();
    } catch (e) {
        console.error(e);
        allVideos = [];
        render();
    }
}

function switchView(view) {
    currentView = view;
    ['btn-week', 'btn-week-m'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("active", view === 'week');
    });
    ['btn-month', 'btn-month-m'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("active", view === 'month');
    });

    document.getElementById("view-week").classList.toggle("hidden", view !== 'week');
    document.getElementById("view-month").classList.toggle("hidden", view !== 'month');
    render();
}

function navigateDate(dir) {
    if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (dir * 7));
    } else {
        currentDate.setMonth(currentDate.getMonth() + dir);
    }
    render();
}

function render() {
    renderStats();
    if (currentView === 'week') {
        renderWeekView();
    } else {
        renderMonthView();
    }
}

// ゲームタイトルの自動判別
function categorizeTitle(title) {
    if (!title) return "その他";
    const t = title.toUpperCase();

    if (t.includes("OW") || t.includes("OVERWATCH") || t.includes("オーバーウォッチ")) return "OW";
    if (t.includes("APEX")) return "APEX";
    if (t.includes("VALORANT") || t.includes("ヴァロ") || t.includes("VALO")) return "VALORANT";
    if (t.includes("スプラ") || t.includes("SPLATOON")) return "スプラ";
    if (t.includes("PUBG")) return "PUBG";
    if (t.includes("LOL") || t.includes("LEAGUE OF LEGENDS") || t.includes("LTK")) return "LoL";
    if (t.includes("GTA") || t.includes("グラセフ") || t.includes("VCR")) return "GTA";
    if (t.includes("マイクラ") || t.includes("MINECRAFT")) return "マイクラ";
    if (t.includes("ポケモン") || t.includes("POKEMON")) return "ポケモン";
    if (t.includes("スト6") || t.includes("SF6")) return "スト6";

    if (t.includes("雑談") || t.includes("メン限")) return "雑談";
    if (t.includes("同時視聴")) return "同時視聴";
    if (t.includes("歌") || t.includes("歌枠")) return "歌枠";

    return "配信";
}

// 週の開始日（月曜日）を取得
function getStartOfWeek(d) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// 【変更】現在表示している「週（7日間）」に含まれる配信だけに絞ってスタッツを集計
function renderStats() {
    const countEl = document.getElementById("stat-count");
    const hoursEl = document.getElementById("stat-hours");

    const startOfWeek = getStartOfWeek(new Date(currentDate));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7); // 週の終わり（次週の月曜0時）

    // 表示中の週に含まれる動画のみ抽出
    const weekVideos = allVideos.filter(v => {
        const vd = new Date(v.publishedAt);
        return vd >= startOfWeek && vd < endOfWeek;
    });

    if (countEl) countEl.textContent = weekVideos.length;

    let totalMinutes = 0;
    const gameMinutes = {};

    weekVideos.forEach(v => {
        const mins = Number(v.durationMinutes) || 120;
        totalMinutes += mins;

        const cat = categorizeTitle(v.title);
        gameMinutes[cat] = (gameMinutes[cat] || 0) + mins;
    });

    if (hoursEl) {
        hoursEl.textContent = (totalMinutes / 60).toFixed(1);
    }

    const tagsContainer = document.getElementById("game-tags-container");
    if (tagsContainer) {
        tagsContainer.innerHTML = "";
        const sortedGames = Object.entries(gameMinutes).sort((a, b) => b[1] - a[1]);

        sortedGames.forEach(([game, mins]) => {
            const hours = (mins / 60).toFixed(1);
            const tag = document.createElement("div");
            tag.className = "game-tag";
            tag.textContent = `${game} ${hours}h`;
            tagsContainer.appendChild(tag);
        });
    }
}

// 週表示 (バーティカルカレンダー / 24時またぎ分割対応)
function renderWeekView() {
    const startOfWeek = getStartOfWeek(new Date(currentDate));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const dateStr = `${startOfWeek.getFullYear()}年 ${startOfWeek.getMonth()+1}/${startOfWeek.getDate()} - ${endOfWeek.getMonth()+1}/${endOfWeek.getDate()}`;
    ['date-range-text', 'date-range-text-m'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = dateStr;
    });

    const timeAxis = document.getElementById("time-axis");
    if (timeAxis) {
        timeAxis.innerHTML = "";
        for (let h = 0; h < 24; h++) {
            const lbl = document.createElement("div");
            lbl.className = "time-lbl";
            lbl.textContent = h;
            timeAxis.appendChild(lbl);
        }
    }

    const headerRow = document.getElementById("week-header-row");
    if (headerRow) {
        headerRow.innerHTML = "<div></div>";
        const days = ['月', '火', '水', '木', '金', '土', '日'];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);

            const div = document.createElement("div");
            div.className = "day-cell";
            div.innerHTML = `<div class="num">${d.getDate()}</div><div class="sub">${days[i]}</div>`;
            headerRow.appendChild(div);
        }
    }

    const grid = document.getElementById("week-grid");
    if (grid) {
        grid.innerHTML = "";
        
        const cols = [];
        for (let i = 0; i < 7; i++) {
            const colDate = new Date(startOfWeek);
            colDate.setDate(colDate.getDate() + i);
            
            const col = document.createElement("div");
            col.className = "week-col";
            cols.push({ date: colDate, element: col });
            grid.appendChild(col);
        }

        allVideos.forEach(v => {
            const startDate = new Date(v.publishedAt);
            const durationMins = Number(v.durationMinutes) || 120;
            const endDate = new Date(startDate.getTime() + durationMins * 60000);

            let currentSegmentStart = new Date(startDate);

            while (currentSegmentStart < endDate) {
                const year = currentSegmentStart.getFullYear();
                const month = currentSegmentStart.getMonth();
                const date = currentSegmentStart.getDate();

                const nextMidnight = new Date(year, month, date + 1, 0, 0, 0);
                const segmentEnd = endDate < nextMidnight ? endDate : nextMidnight;
                const segmentMins = (segmentEnd - currentSegmentStart) / 60000;

                const targetColObj = cols.find(c => c.date.toDateString() === new Date(year, month, date).toDateString());

                if (targetColObj && segmentMins > 0) {
                    const startHour = currentSegmentStart.getHours() + (currentSegmentStart.getMinutes() / 60);
                    const topPx = startHour * 40;
                    const heightPx = Math.max(25, (segmentMins / 60) * 40);

                    const card = document.createElement("div");
                    card.className = "stream-card";
                    card.style.top = `${topPx}px`;
                    card.style.height = `${heightPx}px`;
                    if (v.thumbnails) card.style.backgroundImage = `url(${v.thumbnails})`;

                    const timeStr = `${String(currentSegmentStart.getHours()).padStart(2,'0')}:${String(currentSegmentStart.getMinutes()).padStart(2,'0')}`;
                    card.innerHTML = `
                        <div class="time-tag">${timeStr}</div>
                        <div class="title-txt">${escapeHtml(v.title)}</div>
                    `;
                    card.addEventListener("click", () => openModal(v));
                    targetColObj.element.appendChild(card);
                }

                currentSegmentStart = nextMidnight;
            }
        });
    }
}

function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const dateStr = `${year}年 ${month + 1}月`;
    ['date-range-text', 'date-range-text-m'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = dateStr;
    });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDayIdx = firstDay.getDay() - 1;
    if (startDayIdx === -1) startDayIdx = 6;

    const grid = document.getElementById("month-grid");
    if (grid) {
        grid.innerHTML = "";
        for (let i = 0; i < startDayIdx; i++) {
            const emptyCell = document.createElement("div");
            emptyCell.className = "m-cell";
            grid.appendChild(emptyCell);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const cellDate = new Date(year, month, day);
            const cell = document.createElement("div");
            cell.className = "m-cell";
            cell.innerHTML = `<div class="m-num">${String(day).padStart(2,'0')}</div>`;

            const dayVideos = allVideos.filter(v => new Date(v.publishedAt).toDateString() === cellDate.toDateString());
            if (dayVideos.length > 0 && dayVideos[0].thumbnails) {
                const img = document.createElement("img");
                img.className = "m-thumb";
                img.src = dayVideos[0].thumbnails;
                img.addEventListener("click", () => openModal(dayVideos[0]));
                cell.appendChild(img);
            }
            grid.appendChild(cell);
        }
    }
}

function openModal(video) {
    const vd = new Date(video.publishedAt);
    const cat = categorizeTitle(video.title);
    const mins = Number(video.durationMinutes) || 120;
    const hoursStr = (mins / 60).toFixed(1);

    document.getElementById("modal-thumb").src = video.thumbnails || "";
    document.getElementById("modal-title").textContent = video.title;
    document.getElementById("modal-date").textContent = vd.toLocaleDateString("ja-JP");
    document.getElementById("modal-time").textContent = vd.toLocaleTimeString("ja-JP", {hour: '2-digit', minute:'2-digit'});
    
    const detailsContainer = document.querySelector(".modal-details");
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <div class="detail-row"><span>日付</span><strong>${vd.toLocaleDateString("ja-JP")}</strong></div>
            <div class="detail-row"><span>時間</span><strong>${vd.toLocaleTimeString("ja-JP", {hour: '2-digit', minute:'2-digit'})}</strong></div>
            <div class="detail-row"><span>長さ</span><strong>約${hoursStr}時間 (${mins}分)</strong></div>
        `;
    }

    document.getElementById("modal-link").href = `https://www.youtube.com/watch?v=${video.id}`;

    const badges = document.getElementById("modal-badges");
    if (badges) badges.innerHTML = `<span class="modal-badge">${cat}</span>`;

    document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.classList.add("hidden");
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- 手動メモ管理機能 ---
function initMemoApp() {
    const openBtn = document.getElementById("open-memo-modal");
    const closeBtn = document.getElementById("memo-modal-close");
    const overlay = document.getElementById("memo-modal-overlay");
    const saveBtn = document.getElementById("memo-save-btn");

    if (openBtn) {
        openBtn.addEventListener("click", () => overlay.classList.remove("hidden"));
    }
    if (closeBtn) {
        closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));
    }
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.classList.add("hidden");
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            const title = document.getElementById("memo-input-title").value.trim();
            const date = document.getElementById("memo-input-date").value.trim();
            const badge = document.getElementById("memo-input-badge").value.trim();

            if (!title) {
                alert("タイトルを入力してください");
                return;
            }

            addMemoItem({ title, date, badge });
            
            document.getElementById("memo-input-title").value = "";
            document.getElementById("memo-input-date").value = "";
            document.getElementById("memo-input-badge").value = "";
            overlay.classList.add("hidden");
        });
    }

    renderMemos();
}

function getStoredMemos() {
    const data = localStorage.getItem("custom_memos");
    if (data) {
        try { return JSON.parse(data); } catch(e) { return []; }
    }
    return [
        { title: "ライブ追加グッズ受注販売", date: "10/25 (日) 23:59", badge: "あと6日" },
        { title: "にじUFJ", date: "11/6 (金) 23:59", badge: "あと18日" }
    ];
}

function saveStoredMemos(memos) {
    localStorage.setItem("custom_memos", JSON.stringify(memos));
}

function addMemoItem(memo) {
    const memos = getStoredMemos();
    memos.push(memo);
    saveStoredMemos(memos);
    renderMemos();
}

function deleteMemoItem(index) {
    const memos = getStoredMemos();
    memos.splice(index, 1);
    saveStoredMemos(memos);
    renderMemos();
}

function renderMemos() {
    const container = document.getElementById("memo-list-container");
    if (!container) return;

    const memos = getStoredMemos();
    container.innerHTML = "";

    if (memos.length === 0) {
        container.innerHTML = `<div style="font-size:0.75rem; color:var(--text-sub); text-align:center; padding:6px;">メモはありません</div>`;
        return;
    }

    memos.forEach((m, index) => {
        const item = document.createElement("div");
        item.className = "memo-item";
        item.innerHTML = `
            <span class="due-badge">${escapeHtml(m.badge || "メモ")}</span>
            <div class="memo-content">
                <strong>${escapeHtml(m.title)}</strong>
                <small>${escapeHtml(m.date)}</small>
            </div>
            <button class="memo-delete-btn" onclick="deleteMemoItem(${index})">&times;</button>
        `;
        container.appendChild(item);
    });
}
