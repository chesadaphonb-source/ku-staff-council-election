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
  let activePrivacy;
  const privacyDialog = typeof document.createElement('dialog').showModal === 'function';
  const sendToApp = (type, data = {}) => {
    appWindow.postMessage({ channel: portalChannel, type, frameKey, ...data }, appOrigin);
  };
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
      sendToApp('mount', { privacyDialog });
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
    if (privacyDialog && message.type === 'privacy-open' && Number.isSafeInteger(message.requestId) &&
        validPrivacyCopy(message.copy)) {
      const { requestId, copy } = message;
      activePrivacy?.dialog.remove();
      const dialog = showPrivacyDialog(copy, accepted => {
        if (activePrivacy?.requestId !== requestId) return;
        activePrivacy = undefined;
        sendToApp('privacy-closed', { requestId, accepted });
      });
      activePrivacy = { requestId, dialog };
    }
    if (message.type === 'privacy-cancel' && activePrivacy && message.requestId === activePrivacy.requestId) {
      activePrivacy.dialog.remove();
      activePrivacy = undefined;
    }
  });
  frame.src = url.href;
}

function validPrivacyCopy(copy) {
  return copy && ['title', 'intro', 'heading', 'closing'].every(key => typeof copy[key] === 'string') &&
    Array.isArray(copy.items) && copy.items.every(item => typeof item === 'string');
}

function showPrivacyDialog(copy, onClose) {
  const element = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const dialog = element('dialog');
  dialog.className = 'privacy-dialog';
  const title = element('h2', copy.title);
  title.id = 'privacy-title';
  title.tabIndex = -1;
  title.autofocus = true;
  dialog.setAttribute('aria-labelledby', title.id);

  const items = element('ul');
  items.append(...copy.items.map(item => element('li', item)));
  const closing = element('p');
  closing.className = 'privacy-reassurance';
  closing.append(element('strong', copy.closing));
  const actions = element('div');
  actions.className = 'privacy-actions';
  const accept = element('button', 'ตกลง');
  accept.type = 'button';
  accept.addEventListener('click', () => dialog.close('accepted'));
  actions.append(accept);
  dialog.append(title, element('p', copy.intro), element('h3', copy.heading), items, closing, actions);
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose(dialog.returnValue === 'accepted');
  });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
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
