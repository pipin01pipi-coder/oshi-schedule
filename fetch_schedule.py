import os
import json
import requests
import re
from datetime import datetime

API_KEY = os.environ.get("YOUTUBE_API_KEY")
CHANNEL_ID = os.environ.get("CHANNEL_ID")

def parse_iso8601_duration(duration_str):
    """ISO 8601形式の動画長（PT1H30M15Sなど）を「分単位」に変換する"""
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
    """動画IDリストから実際の配信時間（liveStreamingDetails / contentDetails）を取得する"""
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

        # 配信開始時間（実際の配信開始 > 予定開始 > 投稿日時）
        start_time = (
            l_details.get("actualStartTime") or 
            l_details.get("scheduledStartTime") or 
            snippet.get("publishedAt")
        )
        
        # 配信終了時間
        end_time = l_details.get("actualEndTime")

        # 配信の長さ（分単位）
        duration_minutes = 0
        if start_time and end_time:
            st = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            et = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
            duration_minutes = int((et - st).total_seconds() / 60)
        else:
            duration_minutes = parse_iso8601_duration(c_details.get("duration", ""))
            
        # 最低15分の枠幅を確保（短すぎる動画の表示潰れ防止）
        if duration_minutes <= 0:
            duration_minutes = 120 # 配信予定で終了未定の場合はデフォルト2時間に仮設定

        details_map[v_id] = {
            "startTime": start_time,
            "endTime": end_time,
            "durationMinutes": duration_minutes
        }
    return details_map

def main():
    if not API_KEY or not CHANNEL_ID:
        raise ValueError("YOUTUBE_API_KEY or CHANNEL_ID is not set.")

    print(f"Fetching schedule for channel: {CHANNEL_ID}")
    uploads_id = get_channel_uploads_playlist_id(CHANNEL_ID, API_KEY)

    # 1. プレイリストから最新動画一覧を取得
    url = f"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId={uploads_id}&key={API_KEY}"
    playlist_res = requests.get(url).json()

    raw_items = playlist_res.get("items", [])
    video_ids = [item["snippet"]["resourceId"]["videoId"] for item in raw_items if item.get("snippet", {}).get("resourceId", {}).get("videoId")]

    # 2. 動画の詳細（実際の配信・ライブ時間）をバルク取得
    details_map = get_video_details(video_ids, API_KEY)

    videos = []
    for item in raw_items:
        snippet = item.get("snippet", {})
        v_id = snippet.get("resourceId", {}).get("videoId")
        if not v_id:
            continue
        
        detail = details_map.get(v_id, {})
        start_time = detail.get("startTime") or snippet.get("publishedAt")
        duration_minutes = detail.get("durationMinutes", 120)

        videos.append({
            "id": v_id,
            "title": snippet.get("title"),
            "description": snippet.get("description"),
            "publishedAt": start_time,
            "durationMinutes": duration_minutes,
            "thumbnails": snippet.get("thumbnails", {}).get("high", {}).get("url")
        })

    os.makedirs("data", exist_ok=True)
    output_data = {
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "videos": videos
    }

    with open("data/schedule.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"Successfully updated data/schedule.json with {len(videos)} videos.")

if __name__ == "__main__":
    main()
