/**
 * 일정표 화면 3종. docs/screens.md 5절: 프로그램마다 레이아웃이 다르다.
 * - 워크숍: 일자 × 시간대 격자 (30분 슬롯 매트릭스 + rowSpan, 기존 index.html buildScheduleTable() 재활용)
 * - 심화 멘토링: 권역(열) × 회차(행) 격자 (2026-09-17 결정, docs/screens.md 5절)
 * - 겨울 심화캠프: 일자별 카드
 * 자료 보유 여부는 AppState.data.materials를 세션ID로 대조해 계산한다 (관문 재요청 없음, docs/decisions.md 2절).
 * 자료가 없는 칸/카드는 "자료 없음"만 표시하고 클릭해도 이동하지 않는다 (docs/screens.md 5절).
 */
const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.trim().split(':').map(Number);
  return h * 60 + m;
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { month: m, day: d, weekday: WEEKDAY_KR[new Date(y, m - 1, d).getDay()] };
}

function materialCountBySession(sessionId) {
  if (!AppState.data || !sessionId) return 0;
  return AppState.data.materials.filter(m => m.sessionId === sessionId).length;
}

// 「일정」 탭에 정식 "장소" 열이 없어 비고에 "장소: {장소} · {비고}" 형태로 함께 적는다
// (docs/api.md note 필드 설명, docs/decisions.md 9절 "확인 필요"). 장소는 항상 2개 항목
// (학교 · 장소명)이라 앞 2개를 장소로, 그 뒤에 남는 내용만 진짜 비고로 본다.
function parseNote(note) {
  const match = (note || '').match(/^장소:\s*(.*)$/);
  if (!match) return { location: '', remark: note || '' };
  const parts = match[1].split(' · ');
  if (parts.length <= 2) return { location: match[1], remark: '' };
  return { location: parts.slice(0, 2).join(' · '), remark: parts.slice(2).join(' · ') };
}

function renderScheduleEmptyState() {
  const wrap = document.createElement('div');
  wrap.className = 'placeholder';
  const h = document.createElement('div');
  h.className = 'placeholder-title';
  h.textContent = '등록된 일정이 없습니다';
  const p = document.createElement('div');
  p.className = 'placeholder-note';
  p.textContent = '아직 이 프로그램의 일정이 등록되지 않았습니다.';
  wrap.append(h, p);
  return wrap;
}

/* ---------- 격자 칸 / 카드 공통 ---------- */
function buildSessionCell(session, discipline, program) {
  const count = materialCountBySession(session.sessionId);
  const td = document.createElement('td');
  td.className = 'cell-session' + (count > 0 ? ' has-materials' : '');

  const name = document.createElement('div');
  name.className = 'cell-class';
  name.textContent = session.className;
  td.appendChild(name);

  const { location, remark } = parseNote(session.note);
  const sub = document.createElement('div');
  sub.className = 'cell-sub';
  sub.textContent = [session.instructor, location].filter(Boolean).join(' · ');
  td.appendChild(sub);

  if (remark) {
    const note = document.createElement('div');
    note.className = 'cell-note';
    note.textContent = remark;
    td.appendChild(note);
  }

  const state = document.createElement('div');
  state.className = 'cell-state' + (count > 0 ? ' ready' : '');
  state.textContent = count > 0 ? `● 자료 ${count}개` : '영상 준비중';
  td.appendChild(state);

  td.classList.add('clickable');
  td.addEventListener('click', () => navigate(`#/${discipline}/${program}/${session.sessionId}`));
  return td;
}

function buildSessionCard(session, discipline, program) {
  const count = materialCountBySession(session.sessionId);
  const card = document.createElement('div');
  card.className = 'camp-session' + (count > 0 ? ' has-materials' : '');

  const time = document.createElement('div');
  time.className = 'camp-session-time';
  time.textContent = `${session.startTime}–${session.endTime}`;
  card.appendChild(time);

  const name = document.createElement('div');
  name.className = 'cell-class';
  name.textContent = session.className;
  card.appendChild(name);

  const { location, remark } = parseNote(session.note);
  const sub = document.createElement('div');
  sub.className = 'cell-sub';
  sub.textContent = [session.instructor, location].filter(Boolean).join(' · ');
  card.appendChild(sub);

  if (remark) {
    const note = document.createElement('div');
    note.className = 'cell-note';
    note.textContent = remark;
    card.appendChild(note);
  }

  const state = document.createElement('div');
  state.className = 'cell-state' + (count > 0 ? ' ready' : '');
  state.textContent = count > 0 ? `● 자료 ${count}개` : '영상 준비중';
  card.appendChild(state);

  card.classList.add('clickable');
  card.addEventListener('click', () => navigate(`#/${discipline}/${program}/${session.sessionId}`));
  return card;
}

/* ---------- 워크숍: 일자 × 시간대 격자 ---------- */
function buildWorkshopGrid(sessions, discipline, program) {
  const byDate = {};
  sessions.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
  const dates = Object.keys(byDate).sort();

  let gridStart = Infinity, gridEnd = -Infinity;
  const parsed = {};
  dates.forEach(date => {
    parsed[date] = byDate[date].map(s => {
      const start = timeToMinutes(s.startTime);
      const end = timeToMinutes(s.endTime);
      gridStart = Math.min(gridStart, start);
      gridEnd = Math.max(gridEnd, end);
      return { session: s, start, end };
    }).sort((a, b) => a.start - b.start);
  });
  gridStart = Math.floor(gridStart / 30) * 30;
  gridEnd = Math.ceil(gridEnd / 30) * 30;
  const slotCount = Math.max(1, (gridEnd - gridStart) / 30);

  const matrix = {};
  dates.forEach(date => {
    const col = new Array(slotCount).fill(null);
    parsed[date].forEach(({ session, start, end }) => {
      const startSlot = Math.round((start - gridStart) / 30);
      const span = Math.max(1, Math.round((end - start) / 30));
      if (startSlot < 0 || startSlot >= slotCount) return;
      col[startSlot] = { session, span };
      for (let i = 1; i < span && (startSlot + i) < slotCount; i++) col[startSlot + i] = 'SPANNED';
    });
    matrix[date] = col;
  });

  const wrap = document.createElement('div');
  wrap.className = 'schedule-table-wrap';
  const table = document.createElement('table');
  table.className = 'schedule-grid';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'time-col';
  corner.textContent = '시간';
  headRow.appendChild(corner);
  dates.forEach((date, i) => {
    const { month, day, weekday } = formatDateLabel(date);
    const th = document.createElement('th');
    th.className = 'col-head';
    const main = document.createElement('div');
    main.className = 'col-head-main';
    main.textContent = `DAY ${i + 1}`;
    const sub = document.createElement('div');
    sub.className = 'col-head-sub';
    sub.textContent = `${month}.${day}(${weekday})`;
    th.append(main, sub);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let slot = 0; slot < slotCount; slot++) {
    const tr = document.createElement('tr');
    const mins = gridStart + slot * 30;
    const timeTd = document.createElement('td');
    timeTd.className = 'time-col';
    timeTd.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    tr.appendChild(timeTd);

    dates.forEach(date => {
      const cell = matrix[date][slot];
      if (cell === 'SPANNED') return;
      if (cell === null) {
        const td = document.createElement('td');
        td.className = 'cell-empty';
        tr.appendChild(td);
        return;
      }
      const td = buildSessionCell(cell.session, discipline, program);
      td.rowSpan = cell.span;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/* ---------- 심화 멘토링: 권역(열) × 회차(행) 격자 ---------- */
function buildMentoringGrid(sessions, discipline, program) {
  const regions = Array.from(new Set(sessions.map(s => s.region))).sort((a, b) => a.localeCompare(b, 'ko'));
  const rounds = Array.from(new Set(sessions.map(s => s.round))).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b), 'ko');
  });

  const cellMap = {};
  sessions.forEach(s => {
    const key = `${s.region}__${s.round}`;
    if (!cellMap[key]) cellMap[key] = s;
  });

  const wrap = document.createElement('div');
  wrap.className = 'schedule-table-wrap';
  const table = document.createElement('table');
  table.className = 'schedule-grid';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'time-col';
  corner.textContent = '회차';
  headRow.appendChild(corner);
  regions.forEach(region => {
    const th = document.createElement('th');
    th.className = 'col-head';
    const main = document.createElement('div');
    main.className = 'col-head-main';
    main.textContent = region;
    th.appendChild(main);
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rounds.forEach(round => {
    const tr = document.createElement('tr');
    const roundTd = document.createElement('td');
    roundTd.className = 'time-col';
    roundTd.textContent = `${round}회차`;
    tr.appendChild(roundTd);
    regions.forEach(region => {
      const session = cellMap[`${region}__${round}`];
      if (!session) {
        const td = document.createElement('td');
        td.className = 'cell-empty';
        tr.appendChild(td);
        return;
      }
      tr.appendChild(buildSessionCell(session, discipline, program));
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/* ---------- 겨울 심화캠프: 일자별 카드 ---------- */
function buildCampCards(sessions, discipline, program) {
  const byDate = {};
  sessions.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
  const dates = Object.keys(byDate).sort();

  const wrap = document.createElement('div');
  wrap.className = 'camp-list';

  dates.forEach(date => {
    const { month, day, weekday } = formatDateLabel(date);
    const day_ = document.createElement('div');
    day_.className = 'camp-day';

    const head = document.createElement('div');
    head.className = 'camp-day-head';
    head.textContent = `${month}.${day}(${weekday})`;
    day_.appendChild(head);

    const list = document.createElement('div');
    list.className = 'camp-session-list';
    byDate[date]
      .slice()
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      .forEach(session => list.appendChild(buildSessionCard(session, discipline, program)));
    day_.appendChild(list);

    wrap.appendChild(day_);
  });

  return wrap;
}

/* ---------- 화면 진입 ---------- */
function renderScheduleView(discipline, program) {
  const disciplineInfo = DISCIPLINE_INFO[discipline];
  const disciplineKr = Object.keys(DISCIPLINE_SLUG).find(k => DISCIPLINE_SLUG[k] === discipline);
  const programInfo = PROGRAM_INFO.find(p => p.slug === program);
  if (!disciplineInfo || !programInfo) { navigate('#/'); return; }

  const el = document.getElementById('view-schedule');
  el.replaceChildren();

  if (!AppState.data) {
    el.appendChild(renderScheduleEmptyState());
    showView('view-schedule');
    updateDisciplineSwitcher(discipline);
    return;
  }

  const sessions = AppState.data.sessions.filter(s => s.discipline === disciplineKr && s.program === programInfo.name);

  const header = document.createElement('div');
  header.className = 'schedule-hero';

  const bgImg = document.createElement('img');
  bgImg.className = 'schedule-hero-img';
  bgImg.src = disciplineInfo.photo;
  bgImg.alt = '';
  bgImg.style.objectPosition = disciplineInfo.heroPosition || 'center';
  const scrim = document.createElement('div');
  scrim.className = 'schedule-hero-scrim';

  const content = document.createElement('div');
  content.className = 'schedule-hero-content';

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'schedule-back-btn';
  back.setAttribute('aria-label', '프로그램 다시 선택');
  back.textContent = '←';
  back.addEventListener('click', () => navigate(`#/${discipline}`));

  const title = document.createElement('div');
  title.className = 'schedule-title';
  title.textContent = `${disciplineInfo.name} ${programInfo.name} 일정표`;
  content.append(back, title);

  header.append(bgImg, scrim, content);

  const body = document.createElement('div');
  body.className = 'schedule-body';
  if (sessions.length === 0) {
    body.appendChild(renderScheduleEmptyState());
  } else if (program === 'workshop') {
    body.appendChild(buildWorkshopGrid(sessions, discipline, program));
  } else if (program === 'mentoring') {
    body.appendChild(buildMentoringGrid(sessions, discipline, program));
  } else if (program === 'camp') {
    body.appendChild(buildCampCards(sessions, discipline, program));
  }

  el.append(header, body);
  showView('view-schedule');
  updateDisciplineSwitcher(discipline);
}

registerRoute(/^\/(?<discipline>music|dance|trad|art)\/(?<program>workshop|mentoring|camp)$/, ({ discipline, program }) => renderScheduleView(discipline, program));
