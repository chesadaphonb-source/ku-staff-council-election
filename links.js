'use strict';

const voterAppUrl = document.querySelector('meta[name="voter-app-url"]').content.trim();
const webAppUrl = /^https:\/\/script\.google\.com\/(?:macros|a\/macros\/[A-Za-z0-9._-]+)\/s\/[A-Za-z0-9_-]+\/exec$/;
const appsScriptOrigin = /^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+-)?script\.googleusercontent\.com)$/;
const portalChannel = 'ku-election-portal';
const frame = document.querySelector('#election-frame');
const status = document.querySelector('#frame-message');
const fallback = document.querySelector('#voter-fallback');
status.hidden = false;

if (webAppUrl.test(voterAppUrl)) {
  mountElection();
} else {
  status.textContent = 'ผู้ดูแลยังไม่ได้ตั้งค่าลิงก์เว็บลงคะแนน';
}

function mountElection() {
  fallback.href = voterAppUrl;
  const frameKey = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  const url = new URL(voterAppUrl);
  url.searchParams.set('view', 'embedded');
  url.searchParams.set('frameKey', frameKey);
  let appWindow;
  let appOrigin;
  const wait = window.setTimeout(() => {
    status.textContent = 'เปิดแบบลงคะแนนในหน้านี้ไม่ได้ กรุณาเปิดเว็บลงคะแนนโดยตรง';
    fallback.hidden = false;
  }, 10000);

  window.addEventListener('message', event => {
    const message = event.data;
    if (message?.channel !== portalChannel || message.frameKey !== frameKey) return;
    if (message.type === 'hello' && !appWindow) {
      if (!appsScriptOrigin.test(event.origin) || !belongsToFrame(event.source)) return;
      appWindow = event.source;
      appOrigin = event.origin;
      appWindow.postMessage({ channel: portalChannel, type: 'mount', frameKey }, appOrigin);
    }
    if (event.source !== appWindow || event.origin !== appOrigin) return;
    if (message.type === 'resize' && Number.isFinite(message.height)) {
      frame.height = String(Math.max(240, Math.min(12000, Math.ceil(message.height))));
    }
    if (message.type === 'ready') {
      window.clearTimeout(wait);
      status.hidden = true;
      fallback.hidden = true;
      frame.hidden = false;
    }
  });
  frame.src = url.href;
}

function belongsToFrame(source) {
  const root = frame.contentWindow;
  for (let current = source; current;) {
    if (current === root) return true;
    if (current.parent === current) break;
    current = current.parent;
  }
  return false;
}
