# FakeCatcher API Reference

Version: 1.0  
Base URL: `https://facedetectionsystem.onrender.com`  
Protocol: HTTP / WebSocket  
Auth: None required

FakeCatcher detects deepfakes by analyzing subtle physiological signals (rPPG) extracted from facial regions and classified by a CNN.

## Endpoints

| Method | Endpoint | Description | Constraints |
|---|---|---|---|
| POST | `/predict/frame` | Submit a Base64 JPEG frame | Buffers 128 frames before prediction |
| POST | `/predict/video` | Upload video for async analysis | `.mp4`, `.avi`, `.mov`, `.mkv`, max 50 MB |
| GET | `/jobs/{job_id}` | Poll status/result for a video job | Job TTL: 2 hours |
| GET | `/jobs` | List active jobs | — |
| GET | `/status` | Frame buffer state | — |
| POST | `/reset` | Clear frame buffer | Global/shared buffer |
| GET | `/health` | Liveness check | — |
| GET | `/metrics` | System-wide stats | — |
| WS | `/ws/predict` | Real-time frame streaming | Same 128-frame requirement |

## Frame Prediction

### `POST /predict/frame`

Request body:

```json
{
  "image": "<base64-encoded JPEG>"
}
```

Buffering response:

```json
{
  "status": "buffering",
  "fill_pct": 42,
  "frames_seen": 54,
  "message": "Buffering... 42% — need 128 frames (~4s)"
}
```

Prediction response:

```json
{
  "status": "prediction",
  "label": "REAL",
  "confidence": 92.3,
  "fake_prob": 0.0765,
  "frames_seen": 128
}
```

## Video Prediction

### `POST /predict/video`

Content type: `multipart/form-data`

Field:
- `file` (binary)

Queued response (`202`):

```json
{
  "job_id": "3f2a1b4c-...",
  "status": "queued",
  "filename": "video.mp4",
  "size_mb": 12.5,
  "poll_url": "/jobs/3f2a1b4c-...",
  "message": "Job queued. Poll /jobs/{job_id} for result."
}
```

## Job Management

### `GET /jobs/{job_id}`

Completed response:

```json
{
  "job_id": "3f2a1b4c-...",
  "status": "done",
  "filename": "video.mp4",
  "size_mb": 12.5,
  "result": {
    "label": "FAKE",
    "confidence": 88.4,
    "fake_prob": 0.8843,
    "total_frames": 842,
    "face_pct": 97.3,
    "n_segments": 12
  },
  "error": null,
  "age_sec": 45
}
```

Statuses: `queued`, `processing`, `done`, `error`

### `GET /jobs`

```json
{
  "jobs": {
    "3f2a1b4c-...": {
      "status": "processing",
      "filename": "video.mp4",
      "age_sec": 32
    }
  },
  "counts": {
    "processing": 1
  },
  "total": 1
}
```

## System Endpoints

- `GET /status` returns current buffer state
- `POST /reset` clears shared buffer
- `GET /health` returns model/server liveness
- `GET /metrics` returns workers, queue depth, limits

## WebSocket Streaming

### `WS /ws/predict`

Send one Base64 JPEG string per message.

Receive buffering:

```json
{
  "status": "buffering",
  "fill_pct": 30,
  "frames_seen": 38
}
```

Receive prediction:

```json
{
  "status": "prediction",
  "label": "REAL",
  "confidence": 94.1,
  "fake_prob": 0.058,
  "frames_seen": 256,
  "segments_seen": 3
}
```

## Labels

- `REAL`: Physiological signals look authentic
- `FAKE`: Likely deepfake
- `UNCERTAIN`: Poor or insufficient signal quality

## Limits

- Video uploads: 30 requests/minute
- Max upload size: 50 MB
- Concurrent video jobs: 4
- Job retention: 2 hours
- Minimum frames for prediction: 128

## Error Model

Standard HTTP error code + JSON payload with `detail`:

```json
{
  "detail": "Unsupported format '.wmv'. Use: .mp4, .avi, .mov, .mkv"
}
```

Common codes: `400`, `404`, `413`, `429`, `500`, `503`.

## Local Training/Runtime Repo

Reference implementation and training scripts:
- `https://github.com/dkkinyua/FaceDetectionSystem`
