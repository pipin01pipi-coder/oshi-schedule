document.addEventListener("DOMContentLoaded", () => {
    fetchSchedule();
});

async function fetchSchedule() {
    const listContainer = document.getElementById("schedule-list");
    const totalStreamEl = document.getElementById("total-stream");
    const updateTimeEl = document.getElementById("update-time");

    try {
        // 自動生成されたJSONデータを読み込む
        const response = await fetch("data/schedule.json");
        if (!response.ok) {
            throw new Error("データの取得に失敗しました");
        }
        const data = await response.json();

        // 更新日時と配信数の反映
        if (data.updatedAt) {
            const updateDate = new Date(data.updatedAt);
            updateTimeEl.textContent = updateDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
        }

        const videos = data.videos || [];
        totalStreamEl.textContent = videos.length;

        if (videos.length === 0) {
            listContainer.innerHTML = "<p class='loading-text'>配信データが見つかりませんでした。</p>";
            return;
        }

        // 配信カードの生成
        listContainer.innerHTML = "";
        videos.forEach(video => {
            const card = document.createElement("div");
            card.className = "card";

            const publishedDate = new Date(video.publishedAt).toLocaleString("ja-JP", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });

            card.innerHTML = `
                ${video.thumbnails ? `<img class="card-thumb" src="${video.thumbnails}" alt="${video.title}">` : ''}
                <div class="card-body">
                    <h2 class="card-title">${escapeHtml(video.title)}</h2>
                    <div class="card-date">🕒 ${publishedDate}</div>
                </div>
            `;

            // カードをタップするとYouTube動画へ飛ぶ
            card.addEventListener("click", () => {
                window.open(`https://www.youtube.com/watch?v=${video.id}`, "_blank");
            });

            listContainer.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        listContainer.innerHTML = "<p class='loading-text'>スケジュールデータの読み込みに失敗しました。</p>";
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}
