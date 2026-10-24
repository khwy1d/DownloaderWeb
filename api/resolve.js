import { Innertube } from 'youtubei.js';

const MAX_BODY_LENGTH = 4096;

function extractVideoId(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('الرابط ليس عنوان URL صالحًا.'); }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
    throw new Error('هذا النموذج يدعم روابط YouTube فقط.');
  }
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
  else if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
  else {
    const match = url.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]+)/);
    if (match) id = match[1];
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('لم أستطع تحديد معرّف فيديو صالح من الرابط.');
  return id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'استخدم POST لهذا المسار.' });
  }
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    if (raw.length > MAX_BODY_LENGTH) return res.status(413).json({ error: 'حجم الطلب أكبر من المسموح.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (typeof body.url !== 'string' || body.url.length > 2048) return res.status(400).json({ error: 'أدخل رابط YouTube صالحًا.' });
    const videoId = extractVideoId(body.url);
    console.info('[resolve] start', { videoId });
    const yt = await Innertube.create({ lang: 'ar', location: 'US', enable_session_cache: true });
    const info = await yt.getInfo(videoId);
    const details = info.basic_info || {};
    const rawFormats = info.streaming_data?.formats || [];
    const formats = rawFormats
      .filter((format) => format.has_video && format.has_audio && String(format.mime_type || format.mimeType || '').includes('video/mp4'))
      .map((format) => {
        let streamUrl = format.url;
        if (!streamUrl && typeof format.decipher === 'function') {
          try { streamUrl = format.decipher(yt.session.player); } catch (error) {
            console.warn('[resolve] format decipher failed', format.itag, error?.message);
          }
        }
        return {
          itag: format.itag,
          qualityLabel: format.quality_label || format.qualityLabel || format.quality,
          quality: format.quality,
          mimeType: format.mime_type || format.mimeType || 'video/mp4',
          contentLength: Number(format.content_length || format.contentLength || 0),
          fps: format.fps,
          url: streamUrl
        };
      })
      .filter((format) => typeof format.url === 'string' && format.url.startsWith('https://') && format.qualityLabel)
      .sort((a, b) => (parseInt(b.qualityLabel, 10) || 0) - (parseInt(a.qualityLabel, 10) || 0));
    console.info('[resolve] completed', { videoId, formats: formats.length });
    return res.status(200).json({
      videoId,
      title: details.title || info.primary_info?.title?.text || 'فيديو YouTube',
      author: details.author || '',
      duration: Number(details.duration || 0) ? Math.floor(Number(details.duration) / 60) + ':' + String(Number(details.duration) % 60).padStart(2, '0') : '',
      formats
    });
  } catch (error) {
    console.error('[resolve] failed', error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(422).json({ error: message || 'تعذر استخراج بيانات الفيديو.' });
  }
}