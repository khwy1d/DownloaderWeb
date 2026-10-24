const $ = (selector) => document.querySelector(selector);
const form = $('#resolve-form');
const input = $('#video-url');
const submit = $('#resolve-button');
const resultPanel = $('#result-panel');
const logs = $('#logs');
const formatsBox = $('#formats');
let selectedFormat = null;

function log(message, type = 'info') {
  const empty = logs.querySelector('.log-empty');
  if (empty) empty.remove();
  const item = document.createElement('li');
  const time = document.createElement('time');
  const body = document.createElement('span');
  time.textContent = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  body.textContent = message;
  if (type === 'ok') body.className = 'ok-text';
  if (type === 'error') body.className = 'error-text';
  item.append(time, body);
  logs.prepend(item);
}
function setStatus(label, type = '') {
  const badge = $('#result-status');
  badge.textContent = label;
  badge.className = 'status-badge' + (type ? ' ' + type : '');
}
function prettySize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'الحجم غير معروف';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes, index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index++; }
  return size.toFixed(index ? 1 : 0) + ' ' + units[index];
}
function resetResults() {
  selectedFormat = null;
  formatsBox.replaceChildren();
  $('#download-area').hidden = true;
  $('#video-meta').replaceChildren();
  $('#format-count').textContent = '0';
}
function showError(message, detail) {
  setStatus('فشل الفحص', 'error');
  $('#video-title').textContent = message || 'تعذر استخراج بيانات الفيديو';
  log(detail || message || 'خطأ غير معروف', 'error');
}
function renderResult(data) {
  $('#video-title').textContent = data.title || 'فيديو YouTube';
  setStatus('تم الاستخراج', 'ok');
  const meta = $('#video-meta');
  meta.replaceChildren();
  [data.videoId ? 'ID: ' + data.videoId : '', data.author || '', data.duration ? 'المدة: ' + data.duration : ''].filter(Boolean).forEach((value) => {
    const span = document.createElement('span'); span.textContent = value; meta.append(span);
  });
  const formats = Array.isArray(data.formats) ? data.formats : [];
  $('#format-count').textContent = String(formats.length);
  if (!formats.length) {
    const message = document.createElement('p');
    message.className = 'small-note';
    message.textContent = 'تم جلب بيانات الفيديو، لكن لم يتم العثور على صيغة MP4 تحتوي على الصوت والصورة معًا. هذه نتيجة تشخيصية وليست انهيارًا للتطبيق.';
    formatsBox.append(message);
    log('لم يعثر المستخرج على صيغة progressive تجمع الصوت والصورة.', 'error');
    return;
  }
  formats.forEach((format, index) => {
    const label = document.createElement('label');
    label.className = 'format-option';
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'format'; radio.value = String(index);
    radio.checked = index === 0;
    const main = document.createElement('span'); main.className = 'format-main';
    const title = document.createElement('strong'); title.textContent = format.qualityLabel || format.quality || format.mimeType || 'جودة غير معروفة';
    const sub = document.createElement('small'); sub.textContent = (format.mimeType || 'نوع الملف غير معروف') + ' · ' + (format.fps ? format.fps + ' إطار/ث' : 'معدل الإطارات غير معروف');
    const size = document.createElement('span'); size.className = 'format-size'; size.textContent = prettySize(format.contentLength);
    main.append(title, sub); label.append(radio, main, size); formatsBox.append(label);
    radio.addEventListener('change', () => { selectedFormat = formats[index]; prepareDownload(); });
    if (index === 0) selectedFormat = format;
  });
  $('#download-area').hidden = false;
  prepareDownload();
  log('تم استخراج ' + formats.length + ' صيغة تجمع الصوت والصورة.', 'ok');
}
function prepareDownload() {
  if (!selectedFormat) return;
  $('#download-url').value = selectedFormat.url;
  $('#download-title').value = $('#video-title').textContent;
  $('#download-mime').value = selectedFormat.mimeType || 'video/mp4';
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = input.value.trim();
  resetResults();
  resultPanel.hidden = false;
  $('#video-title').textContent = 'جارٍ استخراج بيانات الفيديو…';
  setStatus('قيد المعالجة');
  submit.disabled = true;
  submit.querySelector('span').textContent = 'جارٍ الفحص…';
  log('بدأ فحص رابط YouTube.');
  try {
    log('التحقق من نوع الرابط.');
    const response = await fetch('/api/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'فشل الخادم (' + response.status + ')');
    log('قبل الخادم الرابط وبدأ استخراج بيانات YouTube.', 'ok');
    renderResult(data);
  } catch (error) {
    showError('تعذر استخراج الفيديو', error?.message || String(error));
  } finally {
    submit.disabled = false;
    submit.querySelector('span').textContent = 'فحص الرابط';
  }
});
$('#sample-button').addEventListener('click', () => {
  input.value = 'https://www.youtube.com/watch?v=jLTOuvBTLxA';
  input.focus();
  log('تم إدخال رابط مثال عام؛ قد يتغير توفره حسب سياسات YouTube.');
});
$('#clear-log').addEventListener('click', () => {
  logs.replaceChildren();
  const empty = document.createElement('li'); empty.className = 'log-empty'; empty.textContent = 'تم مسح السجل. ستظهر هنا مراحل الفحص التالية.'; logs.append(empty);
});
document.querySelector('#download-form').addEventListener('submit', (event) => {
  if (!selectedFormat?.url) { event.preventDefault(); log('لا توجد جودة مختارة للتنزيل.', 'error'); return; }
  log('بدأ إرسال طلب تنزيل الجودة المختارة إلى الخادم.');
});