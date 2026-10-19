import os
import json
import requests
from datetime import datetime

# 環境変数からAPIキーとチャンネルIDを取得
API_KEY = os.environ.get("YOUTUBE_API_KEY")
CHANNEL_ID = os.environ.get("CHANNEL_ID")

def get_channel_uploads_playlist_id(channel_id, api_key):
    """チャンネルのアップロード動画用プレイリストIDを取得する"""
    url = f"https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id={channel_id}&key={api_key}"
    response = requests.get(url)
    data = response.json()
    
    try:
        return data["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
    except (KeyError, IndexError) as e:
        print(f"Error fetching channel details: {data}")
        raise e

def get_playlist_videos(playlist_id, api_key):
    """プレイリストから動画（配信予定含む）のリストを取得する"""
    url = f"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,status&maxResults=50&playlistId={playlist_id}&key={api_key}"
    response = requests.get(url)
    data = response.json()
    
    videos = []
    for item in data.get("items", []):
        snippet = item.get("snippet", {})
        resource_id = snippet.get("resourceId", {})
        video_id = resource_id.get("videoId")
        
        if not video_id:
            continue
            
        videos.append({
            "id": video_id,
            "title": snippet.get("title"),
            "description": snippet.get("description"),
            "publishedAt": snippet.get("publishedAt"),
            "thumbnails": snippet.get("thumbnails", {}).get("high", {}).get("url"),
        })
    return videos

def main():
    if not API_KEY or not CHANNEL_ID:
        raise ValueError("YOUTUBE_API_KEY or CHANNEL_ID is not set in environment variables.")

    print(f"Fetching schedule for channel: {CHANNEL_ID}")
    
    # 1. アップロードプレイリストIDの取得
    uploads_playlist_id = get_channel_uploads_playlist_id(CHANNEL_ID, API_KEY)
    
    # 2. 動画・配信データの取得
    videos = get_playlist_videos(uploads_playlist_id, API_KEY)
    
    # 3. dataディレクトリを作成してJSONとして保存
    os.makedirs("data", exist_ok=True)
    output_path = "data/schedule.json"
    
    output_data = {
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "videos": videos
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully saved {len(videos)} videos to {output_path}")

if __name__ == "__main__":
    main()
