import os
import json
import requests
from datetime import datetime

API_KEY = os.environ.get("YOUTUBE_API_KEY")
CHANNEL_ID = os.environ.get("CHANNEL_ID")

def get_channel_uploads_playlist_id(channel_id, api_key):
    url = f"https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id={channel_id}&key={api_key}"
    res = requests.get(url).json()
    try:
        return res["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
    except (KeyError, IndexError) as e:
        print(f"Error fetching channel details: {res}")
        raise e

def get_video_details(video_ids, api_key):
    """ライブ配信（アーカイブ・予定）の情報を持つ動画だけを厳格に抽出する"""
    if not video_ids:
        return {}
    
    ids_str = ",".join(video_ids)
    url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,liveStreamingDetails&id={ids_str}&key={api_key}"
    res = requests.get(url).json()
    
    details_map = {}
    for item in res.get("items", []):
        v_id = item["id"]
        snippet = item.get("snippet", {})
        l_details = item.get("liveStreamingDetails", {})
        
        # 【重要】liveStreamingDetails（ライブ配信詳細）が存在するものだけに完全に絞る
        # これにより、通常の投稿動画やShortsはすべて綺麗に除外されます
        if not l_details:
            continue

        start_time = (
            l_details.get("actualStartTime") or 
            l_details.get("scheduledStartTime") or 
            snippet.get("publishedAt")
        )
        end_time = l_details.get("actualEndTime")

        # 実際の配信時間を計算（分単位）
        duration_minutes = 120 # デフォルト
        if start_time and end_time:
            st = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            et = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
            calculated_mins = int((et - st).total_seconds() / 60)
            if calculated_mins > 0:
                duration_minutes = calculated_mins

        details_map[v_id] = {
            "startTime": start_time,
            "durationMinutes": duration_minutes
        }
    return details_map

def main():
    if not API_KEY or not CHANNEL_ID:
        raise ValueError("YOUTUBE_API_KEY or CHANNEL_ID is not set.")

    print(f"Fetching strictly live streams for channel: {CHANNEL_ID}")
    uploads_id = get_channel_uploads_playlist_id(CHANNEL_ID, API_KEY)

    # プレイリストから最新動画を取得
    url = f"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId={uploads_id}&key={API_KEY}"
    playlist_res = requests.get(url).json()

    raw_items = playlist_res.get("items", [])
    video_ids = [item["snippet"]["resourceId"]["videoId"] for item in raw_items if item.get("snippet", {}).get("resourceId", {}).get("videoId")]

    # ライブ配信情報を持つものだけを抽出する詳細チェック
    details_map = get_video_details(video_ids, API_KEY)

    videos = []
    for item in raw_items:
        snippet = item.get("snippet", {})
        v_id = snippet.get("resourceId", {}).get("videoId")
        
        # details_map に含まれている（＝ライブ配信である）ものだけを採用
        if not v_id or v_id not in details_map:
            continue 
        
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

    print(f"Successfully filtered only live streams. Saved {len(videos)} videos.")

if __name__ == "__main__":
    main()
