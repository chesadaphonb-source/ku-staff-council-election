const storageKey = 'ku-staff-council-election-demo-v1';
const view = document.querySelector('#view');
const review = document.querySelector('#confirm-vote');
const format = new Intl.NumberFormat('th-TH');
let pendingVote;
let verifiedCode = '';

function sampleElection() {
  return {
    title: 'เลือกตั้งกรรมการสภาพนักงาน',
    candidates: ['ผู้สมัครตัวอย่าง ก', 'ผู้สมัครตัวอย่าง ข', 'ผู้สมัครตัวอย่าง ค'],
    photos: {},
    announcementUrl: '',
    codes: ['DEMO01', 'DEMO02', 'DEMO03'],
    used: [],
    ballots: [],
    phase: 'open',
  };
}

function load() {
  const saved = localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved) : sampleElection();
}

function update(change) {
  const write = () => {
    const election = load();
    change(election);
    localStorage.setItem(storageKey, JSON.stringify(election));
  };
  return navigator.locks ? navigator.locks.request(storageKey, write) : Promise.resolve().then(write);
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeCode(code) {
  return code.trim().toUpperCase();
}

function checkEligibility(election, code) {
  check(election.phase === 'open', 'ปิดรับบัตรลงคะแนนแล้ว');
  check(election.codes.includes(code), 'รหัสนี้ไม่อยู่ในรายชื่อผู้มีสิทธิ์ของรอบทดลอง');
  check(!election.used.includes(code), 'รหัสนี้ใช้สิทธิ์แล้ว');
}

function make(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}

function content(title, description) {
  view.innerHTML = '<h2 id="view-title" tabindex="-1"></h2><p id="feedback" role="alert"></p>';
  view.querySelector('h2').textContent = title;
  if (description) view.querySelector('#feedback').before(make('p', '', description));
}

function feedback(error) {
  view.querySelector('#feedback').textContent = error.message;
}

function notice(message) {
  view.append(make('p', 'notice', message));
}

function options(election) {
  return [...election.candidates, 'ไม่ประสงค์ลงคะแนน'];
}

function renderCandidates(election) {
  content('รายชื่อผู้สมัคร', 'ดูรูป ชื่อ และหมายเลขผู้สมัครก่อนลงคะแนน');
  const list = make('ul', 'candidate-list');
  election.candidates.forEach((name, index) => {
    const item = make('li', 'candidate-card');
    const label = make('div');
    label.append(make('small', '', 'หมายเลข ' + (index + 1)), make('strong', '', name));
    item.append(portrait(election, index), label);
    list.append(item);
  });
  view.append(list);
  if (election.announcementUrl) {
    const link = make('a', 'announcement-link', 'อ่านประกาศการเลือกตั้ง');
    link.href = election.announcementUrl;
    view.append(link);
  }
}

function renderEligibility() {
  content('ตรวจสอบสิทธิ์ลงคะแนน', 'กรอกรหัสผู้มีสิทธิ์ของรอบทดลองเพื่อเปิดบัตรลงคะแนน');
  const form = make('form');
  form.innerHTML = `
    <label class="field">รหัสผู้มีสิทธิ์
      <input name="code" type="text" required maxlength="16" placeholder="เช่น DEMO01" autocomplete="off" spellcheck="false">
    </label>
    <div class="actions"><button>ตรวจสอบสิทธิ์</button></div>`;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = normalizeCode(form.elements.code.value);
    try {
      checkEligibility(load(), code);
      verifiedCode = code;
      render();
      view.querySelector('h2').focus();
    } catch (error) {
      feedback(error);
    }
  });
  view.append(form);
}

function renderBallot(election) {
  if (election.phase !== 'open') {
    content('บัตรลงคะแนน');
    notice('ปิดรับบัตรลงคะแนนแล้ว ดูสถานะได้จากเมนูผลเลือกตั้ง');
    return;
  }
  if (verifiedCode) {
    try {
      checkEligibility(election, verifiedCode);
    } catch (error) {
      verifiedCode = '';
      renderEligibility();
      feedback(error);
      return;
    }
  }
  if (!verifiedCode) {
    renderEligibility();
    return;
  }

  content('บัตรลงคะแนน', 'เลือกหนึ่งรายการ แล้วตรวจทานก่อนส่งบัตร');
  const code = verifiedCode;
  const form = make('form');
  form.innerHTML = `
    <fieldset><legend>ตัวเลือกในบัตร</legend><div class="options"></div></fieldset>
    <div class="actions"><button type="button" class="secondary" id="change-code">เปลี่ยนรหัสผู้มีสิทธิ์</button><button>ตรวจทานบัตร</button></div>`;
  form.querySelector('#change-code').addEventListener('click', () => {
    verifiedCode = '';
    render();
    view.querySelector('input').focus();
  });
  options(election).forEach((name, index) => {
    const abstention = index === election.candidates.length;
    const label = make('label', abstention ? 'option option-abstain' : 'option option-candidate');
    const visual = abstention ? make('span', 'number', '–') : portrait(election, index);
    visual.setAttribute('aria-hidden', 'true');
    const nameBlock = make('span', abstention ? '' : 'option-copy');
    nameBlock.append(make('strong', '', name));
    if (!abstention) nameBlock.prepend(make('small', '', 'ผู้สมัครหมายเลข ' + (index + 1)));
    const radio = make('input');
    Object.assign(radio, { type: 'radio', name: 'choice', value: String(index), required: true });
    label.append(visual, nameBlock, radio);
    form.querySelector('.options').append(label);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const choice = Number(fields.get('choice'));
    try {
      const current = load();
      checkEligibility(current, code);
      const label = options(election)[choice];
      check(label === options(current)[choice] && current.title === election.title, 'รอบเลือกตั้งมีการเปลี่ยนแปลง กรุณาเปิดหน้าลงคะแนนใหม่');
      pendingVote = { code, choice, label, title: current.title };
      document.querySelector('#review-choice').textContent = choice === election.candidates.length ? label : 'หมายเลข ' + (choice + 1) + ' · ' + label;
      review.returnValue = '';
      review.showModal();
    } catch (error) {
      feedback(error);
    }
  });
  view.append(form);
}

review.addEventListener('close', async () => {
  const vote = pendingVote;
  pendingVote = undefined;
  if (review.returnValue !== 'confirm' || !vote) return;
  try {
    await update((election) => {
      checkEligibility(election, vote.code);
      check(vote.label === options(election)[vote.choice] && vote.title === election.title, 'รอบเลือกตั้งมีการเปลี่ยนแปลง กรุณาลองอีกครั้ง');
      election.used.push(vote.code);
      election.ballots.push(vote.choice);
      // Keep ballot order independent of the order in which codes are used.
      election.ballots.sort((a, b) => a - b);
    });
    verifiedCode = '';
    render('รับบัตรลงคะแนนแล้ว รหัสนี้ใช้สิทธิ์เรียบร้อย', { ballotAccepted: true });
  } catch (error) {
    feedback(error);
  }
});

function renderResults(election) {
  content('ผลเลือกตั้ง');
  if (election.phase !== 'published') {
    notice(election.phase === 'open' ? 'จะแสดงคะแนนหลังปิดหีบและเผยแพร่ผล' : 'ปิดหีบแล้ว รอผู้จัดเผยแพร่ผล');
    return;
  }
  const list = make('ol', 'result-list');
  const total = election.ballots.length;
  view.append(make('p', '', 'บัตรลงคะแนนทั้งหมด ' + format.format(total) + ' ใบ'), list);
  options(election).forEach((name, index) => {
    const count = election.ballots.filter((choice) => choice === index).length;
    const entry = make('li');
    const line = make('div', 'result-line');
    const label = index < election.candidates.length ? 'หมายเลข ' + (index + 1) + ' · ' + name : name;
    line.append(make('strong', '', label), make('span', '', format.format(count) + ' คะแนน'));
    const bar = make('progress');
    Object.assign(bar, { max: Math.max(1, total), value: count });
    bar.setAttribute('aria-label', label);
    entry.append(line, bar);
    list.append(entry);
  });
}

async function runAdmin(change, message) {
  try {
    await update(change);
    render(message);
  } catch (error) {
    feedback(error);
  }
}

function renderAdmin(election) {
  content('จัดการรอบทดลอง', 'ตั้งค่าบัตรและรหัสตัวอย่างก่อนมีการใช้สิทธิ์ครั้งแรก');
  if (election.phase === 'open' && election.used.length === 0) {
    const form = make('form');
    form.innerHTML = `
      <label class="field">ชื่อการเลือกตั้ง<input name="title" type="text" required maxlength="80"></label>
      <label class="field">ชื่อผู้สมัคร (หนึ่งชื่อต่อบรรทัด)<textarea name="candidates" required rows="3" maxlength="700"></textarea></label>
      <label class="field">ลิงก์ประกาศการเลือกตั้ง (ถ้ามี)<input name="announcement" type="url" placeholder="https://..." maxlength="600"></label>
      <label class="field">รหัสทดลอง (หนึ่งรหัสต่อบรรทัด)<textarea name="codes" required rows="3" maxlength="500"></textarea></label>
      <div class="actions"><button class="secondary">บันทึกการตั้งค่า</button></div>`;
    form.elements.title.value = election.title;
    form.elements.announcement.value = election.announcementUrl ?? '';
    form.elements.candidates.value = election.candidates.join('\n');
    form.elements.codes.value = election.codes.join('\n');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fields = new FormData(form);
      const title = fields.get('title').trim();
      const announcementUrl = fields.get('announcement').trim();
      const candidates = lines(fields.get('candidates'));
      const codes = [...new Set(lines(fields.get('codes')).map(normalizeCode))];
      runAdmin((current) => {
        check(current.phase === 'open' && !current.used.length, 'รอบนี้เริ่มรับบัตรแล้ว กรุณาเปิดหน้าจัดการใหม่');
        check(title && candidates.length >= 2 && candidates.length <= 10, 'ระบุชื่อการเลือกตั้งและผู้สมัคร 2–10 คน');
        check(!announcementUrl || /^https?:\/\//i.test(announcementUrl), 'ระบุลิงก์ประกาศที่ขึ้นต้นด้วย https:// หรือ http://');
        check(new Set(candidates).size === candidates.length, 'ชื่อผู้สมัครต้องไม่ซ้ำกัน');
        check(codes.length && codes.every((code) => /^[A-Z0-9-]{3,16}$/.test(code)), 'รหัสใช้ A–Z ตัวเลข หรือขีดกลาง จำนวน 3–16 ตัว');
        const photos = Object.fromEntries(candidates.map((name, index) => [
          index, current.photos[current.candidates.indexOf(name)] ?? '',
        ]));
        Object.assign(current, { title, candidates, codes, photos, announcementUrl });
      }, 'บันทึกการตั้งค่าแล้ว');
    });
    view.append(form, photoSettings(election));
  }
  const actions = make('div', 'actions');
  if (election.phase === 'open') {
    addAction(actions, 'ปิดหีบ', () => {
      if (!window.confirm('ปิดหีบและหยุดรับบัตรลงคะแนนใช่ไหม?')) return;
      runAdmin((current) => {
        check(current.phase === 'open', 'รอบนี้ปิดหีบแล้ว');
        current.phase = 'closed';
      }, 'ปิดหีบแล้ว');
    });
  }
  if (election.phase === 'closed') {
    addAction(actions, 'เผยแพร่ผล', () => {
      runAdmin((current) => {
        check(current.phase === 'closed', 'สถานะรอบเลือกตั้งเปลี่ยนแล้ว');
        current.phase = 'published';
      }, 'เผยแพร่ผลแล้ว เปิดเมนูผลเลือกตั้งเพื่อดูคะแนน');
    });
  }
  addAction(actions, 'เริ่มรอบทดลองใหม่', () => {
    if (!window.confirm('ลบคะแนนและการตั้งค่าของรอบทดลองนี้ใช่ไหม?')) return;
    runAdmin((current) => Object.assign(current, sampleElection()), 'เริ่มรอบทดลองใหม่แล้ว');
  }, 'secondary');
  view.append(actions);
}

function portrait(election, index) {
  const wrapper = make('span', 'portrait');
  wrapper.setAttribute('aria-hidden', 'true');
  const source = election.photos[index];
  if (source) {
    const photo = make('img');
    photo.alt = '';
    photo.src = source;
    photo.width = 72;
    photo.height = 84;
    wrapper.append(photo);
  } else {
    wrapper.append(make('span', 'portrait-placeholder'));
  }
  return wrapper;
}

function photoSettings(election) {
  const section = make('section', 'photo-settings');
  section.append(make('h3', '', 'รูปผู้สมัคร'), make('p', '', 'เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 10 MB'));
  election.candidates.forEach((candidate, index) => {
    const row = make('div', 'photo-row');
    const field = make('label', 'field');
    field.append(make('span', '', 'หมายเลข ' + (index + 1) + ' · ' + candidate));
    const input = make('input');
    Object.assign(input, { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    field.append(input);
    row.append(portrait(election, index), field);
    const save = (source, message) => runAdmin((current) => {
      check(current.phase === 'open' && !current.used.length, 'รอบนี้เริ่มรับบัตรแล้ว กรุณาเปิดหน้าจัดการใหม่');
      check(current.candidates[index] === candidate, 'รายชื่อผู้สมัครเปลี่ยนแล้ว กรุณาเปิดหน้าจัดการใหม่');
      current.photos[index] = source;
    }, message);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      input.disabled = true;
      try {
        await save(await preparePhoto(file), 'บันทึกรูปผู้สมัครแล้ว');
      } catch (error) {
        feedback(error);
      } finally {
        input.disabled = false;
        input.value = '';
      }
    });
    if (election.photos[index]) {
      addAction(row, 'เอารูปออก', () => save('', 'เอารูปผู้สมัครออกแล้ว'), 'secondary');
    }
    section.append(row);
  });
  return section;
}

async function preparePhoto(file) {
  check(['image/jpeg', 'image/png', 'image/webp'].includes(file.type), 'เลือกรูป JPG, PNG หรือ WebP');
  check(file.size <= 10 * 1024 * 1024, 'รูปมีขนาดเกิน 10 MB');
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error('เปิดไฟล์รูปไม่ได้ กรุณาเลือกรูปใหม่');
  }
  try {
    const canvas = make('canvas');
    const scale = Math.min(1, 360 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#e8f2eb';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .84);
  } finally {
    image.close();
  }
}

function lines(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function addAction(container, label, onClick, style) {
  const button = make('button', style, label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  container.append(button);
}

function render(message, { ballotAccepted = false } = {}) {
  const election = load();
  const route = ['#candidates', '#results', '#admin'].includes(location.hash) ? location.hash : '#vote';
  const phaseLabels = { open: 'เปิดรับบัตร · รอบทดลอง', closed: 'ปิดหีบ · รอบทดลอง', published: 'เผยแพร่ผลแล้ว · รอบทดลอง' };
  document.querySelector('#election-title').textContent = election.title;
  const phase = document.querySelector('#election-state');
  phase.textContent = phaseLabels[election.phase];
  phase.dataset.phase = election.phase;
  document.querySelector('#used').textContent = format.format(election.used.length);
  document.querySelector('#eligible').textContent = '/ ' + format.format(election.codes.length) + ' ผู้มีสิทธิ์';
  Object.assign(document.querySelector('#turnout'), { max: election.codes.length, value: election.used.length });
  document.querySelector('#demo-codes').replaceChildren(...election.codes.map((code) => make('code', '', code)));
  document.querySelectorAll('nav a').forEach((link) => {
    if (link.hash === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (route === '#candidates') renderCandidates(election);
  else if (route === '#results') renderResults(election);
  else if (route === '#admin') renderAdmin(election);
  else renderBallot(election);
  if (message) {
    const status = make('p', 'notice', message);
    status.setAttribute('role', 'status');
    if (ballotAccepted) {
      const mark = make('span', 'success-mark', '✓');
      mark.setAttribute('aria-hidden', 'true');
      status.classList.add('notice-success');
      status.prepend(mark);
    }
    view.querySelector('h2').after(status);
    status.tabIndex = -1;
    status.focus();
  }
}

window.addEventListener('hashchange', () => {
  render();
  view.querySelector('h2').focus();
});
window.addEventListener('storage', (event) => {
  if (event.key === storageKey || event.key === null) render();
});
render();
