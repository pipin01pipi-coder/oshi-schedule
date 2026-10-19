let allVideos = [];
let currentDate = new Date();
let currentView = 'week';

document.addEventListener("DOMContentLoaded", () => {
    initUI();
    fetchSchedule();
});

function initUI() {
    document.getElementById("btn-week").addEventListener("click", () => switchView('week'));
    document.getElementById("btn-month").addEventListener("click", () => switchView('month'));
    document.getElementById("prev-btn").addEventListener("click", () => navigateDate(-1));
    document.getElementById("next-btn").addEventListener("click", () => navigateDate(1));
    document.getElementById("today-btn").addEventListener("click", () => { currentDate = new Date(); render(); });
    
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-overlay").addEventListener("click", (e) => {
        if (e.target.id === "modal-overlay") closeModal();
    });
}

async function fetchSchedule() {
    try {
        // パスを確実に指定
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
    document.getElementById("btn-week").classList.toggle("active", view === 'week');
    document.getElementById("btn-month").classList.toggle("active", view === 'month');
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
    if (t.includes("OW") || t.includes("OVERWATCH")) return "OW";
    if (t.includes("APEX")) return "APEX";
    if (t.includes("VALORANT")) return "VALORANT";
    if (t.includes("スプラ")) return "スプラ";
    return "配信";
}

function renderStats() {
    document.getElementById("stat-count").textContent = allVideos.length;
    document.getElementById("stat-hours").textContent = (allVideos.length * 2.5).toFixed(1);

    const gameCounts = {};
    allVideos.forEach(v => {
        const cat = categorizeTitle(v.title);
        gameCounts[cat] = (gameCounts[cat] || 0) + 2.5;
    });

    const tagsContainer = document.getElementById("game-tags-container");
    tagsContainer.innerHTML = "";
    Object.entries(gameCounts).forEach(([game, hours]) => {
        const tag = document.createElement("div");
        tag.className = "game-tag";
        tag.textContent = `${game} ${hours}h`;
        tagsContainer.appendChild(tag);
    });
}

function renderWeekView() {
    const startOfWeek = getStartOfWeek(new Date(currentDate));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    document.getElementById("date-range-text").textContent = 
        `${startOfWeek.getFullYear()}年 ${startOfWeek.getMonth()+1}/${startOfWeek.getDate()} - ${endOfWeek.getMonth()+1}/${endOfWeek.getDate()}`;

    // 時間軸
    const timeAxis = document.getElementById("time-axis");
    timeAxis.innerHTML = "";
    for (let h = 0; h < 24; h++) {
        const lbl = document.createElement("div");
        lbl.className = "time-lbl";
        lbl.textContent = h;
        timeAxis.appendChild(lbl);
    }

    // 曜日
    const headerRow = document.getElementById("week-header-row");
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

    // グリッド
    const grid = document.getElementById("week-grid");
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
            const topPx = startHour * 40;

            const card = document.createElement("div");
            card.className = "stream-card";
            card.style.top = `${topPx}px`;
            card.style.height = `80px`;
            if (v.thumbnails) card.style.backgroundImage = `url(${v.thumbnails})`;

            const timeStr = `${String(vd.getHours()).padStart(2,'0')}:${String(vd.getMinutes()).padStart(2,'0')}`;
            card.innerHTML = `
                <div class="time-tag">${timeStr}</div>
                <div class="title-txt">${escapeHtml(v.title)}</div>
            `;
            card.addEventListener("click", () => openModal(v));
            col.appendChild(card);
        });

        grid.appendChild(col);
    }
}

function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById("date-range-text").textContent = `${year}年 ${month + 1}月`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDayIdx = firstDay.getDay() - 1;
    if (startDayIdx === -1) startDayIdx = 6;

    const grid = document.getElementById("month-grid");
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

function getStartOfWeek(d) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function openModal(video) {
    const vd = new Date(video.publishedAt);
    const cat = categorizeTitle(video.title);

    document.getElementById("modal-thumb").src = video.thumbnails || "";
    document.getElementById("modal-title").textContent = video.title;
    document.getElementById("modal-date").textContent = vd.toLocaleDateString("ja-JP");
    document.getElementById("modal-time").textContent = vd.toLocaleTimeString("ja-JP", {hour: '2-digit', minute:'2-digit'});
    document.getElementById("modal-link").href = `https://www.youtube.com/watch?v=${video.id}`;

    const badges = document.getElementById("modal-badges");
    badges.innerHTML = `<span class="modal-badge">${cat}</span>`;

    document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
