# SunoPull public song API

The skill uses this endpoint to resolve one public Suno song and get a media URL.

## Resolve a song

    POST https://sunopull.com/api/v1/suno/resolve
    Content-Type: application/json

    { "url": "https://suno.com/song/..." }

Successful responses use the standard SunoPull response envelope:

    {
      "code": 0,
      "message": "ok",
      "data": {
        "track": {
          "id": "...",
          "title": "...",
          "artist": "...",
          "duration": 123
        },
        "file": {
          "format": "mp3",
          "downloadUrl": "https://sunopull.com/api/suno/media/..."
        }
      }
    }

The audio format is the original source format available for that public track. The returned media URL uses SunoPull's media proxy and streams the source audio when requested.

## Limits and errors

- Only a public Suno song, Hook, or share link is accepted.
- Private, deleted, and inaccessible tracks cannot be resolved.
- Requests are rate-limited to one resolve call every two seconds per client IP and Worker instance.
- HTTP errors include a short message. Common statuses include 400 for an invalid link, 404 for a missing public page, 413 for an oversized request, 422 for a link without downloadable audio, 429 for rate limiting, and 502 for an upstream Suno error.
- The API does not require an account or API key. Do not send Suno cookies, credentials, or private page data.

The API only returns original audio. MP3/WAV conversion remains available through the SunoPull website's browser workflow.
