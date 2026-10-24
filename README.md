# Downloader Lab — YouTube web demo

A small web test harness for the Android DownloaderApp project. It is isolated in this folder and does not change the Android application.

## What it does

- Accepts public YouTube watch, short, Shorts, live, and embed URLs.
- Resolves metadata and progressive MP4 formats (formats containing both audio and video) with `youtubei.js`.
- Shows extraction status and readable diagnostics in the browser.
- Streams a selected format through a server endpoint, avoiding browser CORS restrictions on the media URL.

## Run locally

Requires Node.js 20 or newer.

```sh
cd web-demo
npm install
npx vercel dev
```

Then open the local URL printed by Vercel CLI. The `api/` directory contains Vercel Node.js functions.

## Deploy as a preview

Create a Vercel project linked to this repository and set its **Root Directory** to `web-demo`. Use a preview deployment first. Do not change the Android app's existing project or production deployment settings.

## Diagnostics

- `/api/resolve` validates the YouTube URL and returns title plus progressive MP4 formats.
- Server logs prefix extraction events with `[resolve]`; download events use `[download]`.
- If no progressive format is available, the UI reports that explicitly rather than silently downloading a web page.
- YouTube extraction is dependent on upstream changes and may fail for private, age-restricted, region-restricted, or otherwise unavailable videos.
- Serverless streaming duration/limits depend on the hosting plan. Large downloads may require a dedicated long-running backend instead.

Use only videos you have permission to download and comply with the platform's terms and applicable law.
