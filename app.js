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

function categorizeTitle(title) {
    const t = title.toUpperCase();
    if (t.includes("OW") || t.includes("OVERWATCH") || t.includes("オーバーウォッチ")) return "OW";
    if (t.includes("APEX")) return "APEX";
    if (t.includes("VALORANT") || t.includes("ヴァロ")) return "VALORANT";
    if (t.includes("スプラ")) return "スプラ";
    return "配信";
}

// 実際の配信分（durationMinutes）に基づく正確な合計時間の算出
function renderStats() {
    const countEl = document.getElementById("stat-count");
    const hoursEl = document.getElementById("stat-hours");

    if (countEl) countEl.textContent = allVideos.length;

    let totalMinutes = 0;
    const gameMinutes = {};

    allVideos.forEach(v => {
        const mins = v.durationMinutes || 120;
        totalMinutes += mins;

        const cat = categorizeTitle(v.title);
        gameMinutes[cat] = (gameMinutes[cat] || 0) + mins;
    });

    if (hoursEl) hoursEl.textContent = (totalMinutes / 60).toFixed(1);

    const tagsContainer = document.getElementById("game-tags-container");
    if (tagsContainer) {
        tagsContainer.innerHTML = "";
        Object.entries(gameMinutes).forEach(([game, mins]) => {
            const hours = (mins / 60).toFixed(1);
            const tag = document.createElement("div");
            tag.className = "game-tag";
            tag.textContent = `${game} ${hours}h`;
            tagsContainer.appendChild(tag);
        });
    }
}

// 週表示 (バーティカルの高さと位置を実際の配信時間から算出)
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

            // その日の合計配信時間を計算してヘッダーに表示
            const dayVideos = allVideos.filter(v => new Date(v.publishedAt).toDateString() === d.toDateString());
            const dayMins = dayVideos.reduce((sum, v) => sum + (v.durationMinutes || 120), 0);
            const dayHoursStr = dayMins > 0 ? `${(dayMins / 60).toFixed(1)}h` : '';

            const div = document.createElement("div");
            div.className = "day-cell";
            div.innerHTML = `<div class="num">${d.getDate()}</div><div class="sub">${days[i]}</div><div class="sub">${dayHoursStr}</div>`;
            headerRow.appendChild(div);
        }
    }

    const grid = document.getElementById("week-grid");
    if (grid) {
        grid.innerHTML = "";
        for (let i = 0; i < 7; i++) {
            const colDate = new Date(startOfWeek);
            colDate.setDate(colDate.getDate() + i);
            
            const col = document.createElement("div");
            col.className = "week-col";

            const dayVideos = allVideos.filter(v => {
                const vd = new Date(v.publishedAt);
                return vd.toDateString() === colDate.toDateString();
            });

            dayVideos.forEach(v => {
                const vd = new Date(v.publishedAt);
                const startHour = vd.getHours() + (vd.getMinutes() / 60);
                
                // 1時間 = 40px で計算 (40px/60分)
                const topPx = startHour * 40;
                
                // 実際の配信分（durationMinutes）に応じた伸縮枠（最低40px）
                const durationMins = v.durationMinutes || 120;
                const heightPx = Math.max(30, (durationMins / 60) * 40);

                const card = document.createElement("div");
                card.className = "stream-card";
                card.style.top = `${topPx}px`;
                card.style.height = `${heightPx}px`;
                if (v.thumbnails) card.style.backgroundImage = `url(${v.thumbnails})`;

                const timeStr = `${String(vd.getHours()).padStart(2,'0')}:${String(vd.getMinutes()).padStart(2,'0')}`;
                const hoursLenStr = `${(durationMins / 60).toFixed(1)}h`;

                card.innerHTML = `
                    <div class="time-tag">${timeStr} (${hoursLenStr})</div>
                    <div class="title-txt">${escapeHtml(v.title)}</div>
                `;
                card.addEventListener("click", () => openModal(v));
                col.appendChild(card);
            });

            grid.appendChild(col);
        }
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

function getStartOfWeek(d) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function openModal(video) {
    const vd = new Date(video.publishedAt);
    const cat = categorizeTitle(video.title);
    const mins = video.durationMinutes || 120;
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
    badges.innerHTML = `<span class="modal-badge">${cat}</span>`;

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
