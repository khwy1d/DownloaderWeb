const MAX_TITLE_LENGTH = 180;
const ALLOWED_HOST = /(^|\.)googlevideo\.com$/i;

function safeStreamUrl(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || !ALLOWED_HOST.test(url.hostname)) return null;
  return url;
}
function safeFilename(value) {
  const cleaned = String(value || 'youtube-video')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
  return (cleaned || 'youtube-video') + '.mp4';
}
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('استخدم POST لهذا المسار.');
  }
  const url = safeStreamUrl(req.body?.url);
  if (!url) return res.status(400).send('رابط البث غير صالح أو غير مسموح.');
  const filename = safeFilename(req.body?.title);
  try {
    const headers = {};
    if (typeof req.headers.range === 'string') headers.Range = req.headers.range;
    const upstream = await fetch(url, { headers, redirect: 'manual' });
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      const redirectUrl = location ? safeStreamUrl(new URL(location, url).toString()) : null;
      if (!redirectUrl) return res.status(502).send('رفض الخادم تحويلًا إلى عنوان غير موثوق.');
      const redirected = await fetch(redirectUrl, { headers, redirect: 'manual' });
      return pipeResponse(redirected, res, filename);
    }
    return pipeResponse(upstream, res, filename);
  } catch (error) {
    console.error('[download] failed', error);
    if (!res.headersSent) return res.status(502).send('تعذر بدء التنزيل. أعد استخراج الرابط ثم حاول مجددًا.');
    return res.end();
  }
}
function pipeResponse(upstream, res, filename) {
  if (!upstream.ok && upstream.status !== 206) return res.status(upstream.status || 502).send('فشل خادم الفيديو في بدء التنزيل.');
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
  res.setHeader('Content-Disposition', 'attachment; filename="youtube-video.mp4"; filename*=UTF-8\'\'' + encodeURIComponent(filename));
  for (const header of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  if (!upstream.body) return res.end();
  const reader = upstream.body.getReader();
  const pump = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(Buffer.from(value))) await new Promise((resolve) => res.once('drain', resolve));
      }
      res.end();
    } catch (error) {
      console.error('[download] stream interrupted', error);
      res.destroy(error);
    }
  };
  pump();
}