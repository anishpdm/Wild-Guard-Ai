# services/video_streamer.py
"""
Video Streamer
  CAM-01 → device camera (handled in React, no backend needed)
  CAM-02..06 → MP4 files in backend/videos/, streamed as chunked HTTP

Place free elephant MP4s in backend/videos/:
  cam02.mp4  cam03.mp4  cam04.mp4  cam05.mp4  cam06.mp4

Free sources (no login required):
  https://pixabay.com/videos/search/elephant/
  https://www.pexels.com/search/videos/elephant/

The stream endpoint supports HTTP Range so the browser can seek
and loop — it appears identical to a live CCTV feed.
"""

import aiofiles
from pathlib import Path
from fastapi import Request
from fastapi.responses import StreamingResponse, JSONResponse

VIDEO_DIR  = Path(__file__).parent.parent / "videos"
CHUNK_SIZE = 256 * 1024   # 256 KB

VIDEO_MAP = {
    "CAM-02": "cam02.mp4",
    "CAM-03": "cam03.mp4",
    "CAM-04": "cam04.mp4",
    "CAM-05": "cam05.mp4",
    "CAM-06": "cam06.mp4",
}


def video_status() -> dict:
    out = {}
    for cid, fname in VIDEO_MAP.items():
        p = VIDEO_DIR / fname
        out[cid] = {
            "available":  p.exists(),
            "filename":   fname,
            "size_mb":    round(p.stat().st_size/1e6,1) if p.exists() else None,
            "stream_url": f"/stream/video/{cid}",
        }
    return out


async def stream_video(camera_id: str, request: Request):
    fname = VIDEO_MAP.get(camera_id)
    if not fname:
        raise Exception(f"Unknown camera: {camera_id}")

    path = VIDEO_DIR / fname
    if not path.exists():
        return JSONResponse(status_code=404, content={
            "error": f"Video file not found: {fname}",
            "fix":   f"Download a free elephant MP4 and save as backend/videos/{fname}",
            "sources": ["https://pixabay.com/videos/search/elephant/",
                        "https://www.pexels.com/search/videos/elephant/"],
        })

    file_size   = path.stat().st_size
    range_header= request.headers.get("range","")

    if range_header:
        parts  = range_header.replace("bytes=","").split("-")
        start  = int(parts[0])
        end    = int(parts[1]) if parts[1] else file_size-1
        end    = min(end, file_size-1)
        length = end - start + 1

        async def _range_gen():
            async with aiofiles.open(path,"rb") as f:
                await f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = await f.read(min(CHUNK_SIZE, remaining))
                    if not chunk: break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(_range_gen(), status_code=206,
            media_type="video/mp4",
            headers={
                "Content-Range":  f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges":  "bytes",
                "Content-Length": str(length),
                "Cache-Control":  "no-cache",
            })
    else:
        async def _full_gen():
            async with aiofiles.open(path,"rb") as f:
                while True:
                    chunk = await f.read(CHUNK_SIZE)
                    if not chunk: break
                    yield chunk

        return StreamingResponse(_full_gen(), media_type="video/mp4",
            headers={
                "Accept-Ranges":  "bytes",
                "Content-Length": str(file_size),
                "Cache-Control":  "no-cache",
            })
