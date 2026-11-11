---
name: sunopull-download
description: Download one publicly accessible Suno song through SunoPull. Use when the user explicitly asks to download or save a Suno song from a song, Hook, or share link.
compatibility: Requires Node.js 20+, outbound HTTPS access, and permission to write downloaded files to the local filesystem.
metadata:
  author: SunoPull
  version: '0.1.0'
---

# Download a Suno song with SunoPull

Use this skill only when the user asks to download or save a song. A pasted link by itself is not a download request.

## Supported input

- One publicly accessible Suno song, Hook, or share link.
- The download preserves the original audio format exposed for that song (MP3, M4A, or WAV).
- This first version does not convert formats or download albums, playlists, lyrics, or cover art.

## Workflow

1. Confirm the user asked to save the linked song. Use the output directory they specify; otherwise save to ./downloads.
2. Pass the URL as a separate command-line argument to the script. Never evaluate the URL as shell code. If the command runner uses a shell, quote the argument with that shell's normal argument-quoting rules.
3. Run the following command, adding the user's URL and output directory as arguments:

       node scripts/download.mjs --url <public-suno-url> --output-dir <directory>

   Omit --output-dir to use ./downloads.

4. Report the saved file path and the format returned by SunoPull. Do not claim success unless the script exits successfully and prints the path.

## Access and limits

- The script sends the public Suno URL to SunoPull to resolve the song, then downloads its available audio through SunoPull.
- Do not use this skill to access private songs, bypass Suno account restrictions, or download content the user does not have permission to use.
- If SunoPull reports that a page or audio source is unavailable, explain the error and stop. Do not retry with cookies, credentials, or alternate private endpoints.
- If the user needs MP3/WAV conversion or other files, direct them to the matching SunoPull website tool. This script preserves the source format.

## Script

- scripts/download.mjs — resolves one public link and saves the original audio. It does not overwrite an existing file.
