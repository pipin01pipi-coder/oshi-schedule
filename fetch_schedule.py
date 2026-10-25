import os
import json
import requests
import re
from datetime import datetime

API_KEY = os.environ.get("YOUTUBE_API_KEY")
CHANNEL_ID = os.environ.get("CHANNEL_ID")

def parse_iso8601_duration(duration_str):
    """ISO 8601形式の動画長を分単位に変換"""
    if not duration_str:
        return 0
    pattern = re.compile(r'PT(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?')
    match = pattern.match(duration_str)
    if not match:
        return 0
    parts = match.groupdict()
    hours = int(parts['hours'] or 0)
    minutes = int(parts['minutes'] or 0)
    seconds = int(parts['seconds'] or 0)
    return hours * 60 + minutes + round(seconds / 60)

def get_channel_uploads_playlist_id(channel_id, api_key):
    url = f"https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id={channel_id}&key={api_key}"
    res = requests.get(url).json()
    try:
        return res["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
    except (KeyError, IndexError) as e:
        print(f"Error fetching channel details: {res}")
        raise e

def get_video_details(video_ids, api_key):
    """動画の詳細情報を取得し、生放送（ライブ配信・アーカイブ）かどうかを判別する"""
    if not video_ids:
        return {}
    
    ids_str = ",".join(video_ids)
    url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,liveStreamingDetails&id={ids_str}&key={api_key}"
    res = requests.get(url).json()
    
    details_map = {}
    for item in res.get("items", []):
        v_id = item["id"]
        snippet = item.get("snippet", {})
        c_details = item.get("contentDetails", {})
        l_details = item.get("liveStreamingDetails", {})
        
        # 判定: liveStreamingDetails が存在するもの、あるいはタイトル等に配信系キーワードが含まれるものを「配信」とする
        # ※Shorts（縦長動画）は通常 liveStreamingDetails を持ちません
        is_live = bool(l_details)
        
        # タイトルや説明文に「Shorts」「#shorts」が含まれる場合は除外
        title = snippet.get("title", "")
        if "#shorts" in title.lower() or "#ショート" in title:
            continue

        # 動画の長さ（分単位）
        duration_str = c_details.get("duration", "")
        duration_minutes = parse_iso8601_duration(duration_str)

        # 【重要】もし liveStreamingDetails が無い場合でも、配信アーカイブとみなせる長めの動画（例: 10分以上）なら許容、短すぎるもの（Shorts等）は除外
        # または完全な「ライブ配信（アーカイブ・予定）」だけに絞る場合は `if not is_live: continue` にしてください
        if not is_live and duration_minutes < 10:
            continue # 10分未満の通常の動画やShortsは除外

        start_time = (
            l_details.get("actualStartTime") or 
            l_details.get("scheduledStartTime") or 
            snippet.get("publishedAt")
        )
        end_time = l_details.get("actualEndTime")

        if start_time and end_time:
            st = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            et = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
            calculated_mins = int((et - st).total_seconds() / 60)
            if calculated_mins > 0:
                duration_minutes = calculated_mins

        if duration_minutes <= 0:
            duration_minutes = 120

        details_map[v_id] = {
            "isLive": is_live,
            "startTime": start_time,
            "durationMinutes": duration_minutes
        }
    return details_map

def main():
    if not API_KEY or not CHANNEL_ID:
        raise ValueError("YOUTUBE_API_KEY or CHANNEL_ID is not set.")

    print(f"Fetching live streams for channel: {CHANNEL_ID}")
    uploads_id = get_channel_uploads_playlist_id(CHANNEL_ID, API_KEY)

    # プレイリストから最新動画を取得
    url = f"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId={uploads_id}&key={API_KEY}"
    playlist_res = requests.get(url).json()

    raw_items = playlist_res.get("items", [])
    video_ids = [item["snippet"]["resourceId"]["videoId"] for item in raw_items if item.get("snippet", {}).get("resourceId", {}).get("videoId")]

    # 詳細情報を取得してフィルタリング
    details_map = get_video_details(video_ids, API_KEY)

    videos = []
    for item in raw_items:
        snippet = item.get("snippet", {})
        v_id = snippet.get("resourceId", {}).get("videoId")
        if not v_id or v_id not in details_map:
            continue # 配信フィルターに引っかからなかったもの（Shortsや通常動画）は除外される
        
        detail = details_map[v_id]
        videos.append({
            "id": v_id,
            "title": snippet.get("title"),
            "description": snippet.get("description"),
            "publishedAt": detail["startTime"],
            "durationMinutes": detail["durationMinutes"],
            "thumbnails": snippet.get("thumbnails", {}).get("high", {}).get("url")
        })

    os.makedirs("data", exist_ok=True)
    output_data = {
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "videos": videos
    }

    with open("data/schedule.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"Successfully filtered and saved {len(videos)} live streams.")

if __name__ == "__main__":
    main()
