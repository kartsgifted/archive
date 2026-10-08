/**
 * 일정표 화면 3종. docs/screens.md 5절: 프로그램마다 레이아웃이 다르다.
 * - 워크숍: 일자 × 시간대 격자. 실제 일정표처럼 수업 칸을 길이만큼 세로로 늘이고, 같은 시간 수업은 좌우로 나눈다 (2026-10-08 변경)
 * - 심화 멘토링: 권역(열) × 회차(행) 격자 (2026-09-17 결정, docs/screens.md 5절)
 * - 겨울 심화캠프: 일자별 카드
 * 자료 보유 여부는 AppState.data.materials를 세션ID로 대조해 계산한다 (관문 재요청 없음, docs/decisions.md 2절).
 * 자료가 없는 칸(점심·등록·개별 연습 등)은 흐리게 두고 누를 수 없다 (2026-10-08, 부실장님 피드백).
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
  const counts = { video: 0, photo: 0 };
  if (!AppState.data || !sessionId) return counts;
  AppState.data.materials.forEach(m => {
    if (m.sessionId !== sessionId) return;
    if (m.type === '영상') counts.video++;
    else if (m.type === '사진' || m.type === '사진묶음') counts.photo++;
  });
  return counts;
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

/* ---------- 격자 칸 / 카드 / 칸 안 항목 공통 ---------- */
// 수업명 · 강사·장소 · 비고 · 자료 상태를 el 안에 채우고, 자료가 있으면 누를 때 자료 화면으로 간다.
// 자료가 없으면 흐리게(idle) 두고 누를 수 없다 — 점심·등록 칸을 눌러 보는 헛걸음을 없앤다(2026-10-08).
// timeLabel이 있으면 맨 위에 시간(또는 일자·시간)을 적는다.
function fillSession(el, session, discipline, program, timeLabel) {
  const { video, photo } = materialCountBySession(session.sessionId);
  const hasMaterials = video + photo > 0;
  el.classList.add(hasMaterials ? 'has-materials' : 'idle');

  if (timeLabel) {
    const time = document.createElement('div');
    time.className = 'session-time';
    time.textContent = timeLabel;
    el.appendChild(time);
  }

  const name = document.createElement('div');
  name.className = 'cell-class';
  name.textContent = session.className;
  el.appendChild(name);

  const { location, remark } = parseNote(session.note);
  const subText = [session.instructor, location].filter(Boolean).join(' · ');
  if (subText) {
    const sub = document.createElement('div');
    sub.className = 'cell-sub';
    sub.textContent = subText;
    el.appendChild(sub);
  }

  if (remark) {
    const note = document.createElement('div');
    note.className = 'cell-note';
    note.textContent = remark;
    el.appendChild(note);
  }

  if (!hasMaterials) return el;

  const state = document.createElement('div');
  state.className = 'cell-state ready';
  state.textContent = '● ' + [video ? `영상 ${video}` : '', photo ? `사진 ${photo}` : ''].filter(Boolean).join(' · ');
  el.appendChild(state);

  el.classList.add('clickable');
  el.addEventListener('click', () => navigate(`#/${discipline}/${program}/${session.sessionId}`));
  return el;
}

function buildSessionCell(session, discipline, program) {
  const td = document.createElement('td');
  td.className = 'cell-session';
  return fillSession(td, session, discipline, program);
}

function buildSessionCard(session, discipline, program) {
  const card = document.createElement('div');
  card.className = 'camp-session';
  return fillSession(card, session, discipline, program, `${session.startTime}–${session.endTime}`);
}

// 한 칸에 수업이 여럿일 때: 수업마다 시간을 붙여 위아래로 나열한다 (docs/decisions.md 9절 「같은 분야 동시간대 수업」)
function buildSessionListCell(items, discipline, program) {
  const td = document.createElement('td');
  td.className = 'cell-slot';
  items.forEach(({ session, label }) => {
    const item = document.createElement('div');
    item.className = 'slot-item';
    td.appendChild(fillSession(item, session, discipline, program, label));
  });
  return td;
}

// 같은 시각이면 세션ID 끝 순번(…-1000-2) 순서로
function sessionSeq(s) {
  return Number(String(s.sessionId || '').split('-').pop()) || 0;
}

/* ---------- 워크숍: 일자 × 시간대 격자 ---------- */
// 받은 실제 일정표(2026-10-08)처럼 수업 칸을 길이만큼 세로로 늘이고(rowSpan),
// 같은 시간에 열린 수업은 그 날짜 열을 좌우로 나눠 나란히 그린다(colSpan).
// 「일정」이 실제 일정표 칸 단위라 같은 시간 수업은 최대 2개다. 겹치는 수업끼리 한 묶음으로 보고,
// 묶음 안에서 세션ID 순번(왼쪽부터 1, 2) 순서로 줄을 배정한다. 겹치는 게 없는 수업은 열 전체를 쓴다.
function assignLanes(items) {
  const clusters = [];
  let current = null, clusterEnd = -Infinity;
  items.forEach(it => {
    if (!current || it.start >= clusterEnd) { current = []; clusters.push(current); clusterEnd = -Infinity; }
    current.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  });
  clusters.forEach(cluster => {
    const laneEnds = [];
    cluster.forEach(it => {
      let lane = laneEnds.findIndex(end => end <= it.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = it.end;
      it.lane = lane;
    });
    cluster.forEach(it => { it.laneCount = laneEnds.length; });
  });
  return Math.max(1, ...items.map(it => it.laneCount || 1));
}

// 칸 색: 원본 일정표처럼 수업마다 색을 다르게 하고, 같은 수업은 날짜가 달라도 같은 색으로 둔다(2026-10-08).
// 괄호와 끝의 A/B는 떼고 묶는다 — 특강(초등)·특강(중고등), 융합창작 A·B가 같은 색. 색상(hue)만 정하고 밝기는 CSS가 정한다.
const SESSION_TONES = [265, 175, 28, 212, 340, 145, 48, 192, 300, 100];

function createToneMap() {
  const map = {};
  return name => {
    const key = String(name || '').replace(/\(.*?\)/g, '').replace(/\s+[A-Z]$/, '').trim();
    if (!(key in map)) map[key] = SESSION_TONES[Object.keys(map).length % SESSION_TONES.length];
    return map[key];
  };
}

function buildWorkshopGrid(sessions, discipline, program) {
  const toneOf = createToneMap();
  const byDate = {};
  sessions.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
  const dates = Object.keys(byDate).sort();

  let gridStart = Infinity, gridEnd = -Infinity;
  const parsed = {};
  dates.forEach(date => {
    parsed[date] = byDate[date].map(s => {
      const start = timeToMinutes(s.startTime);
      const end = Math.max(timeToMinutes(s.endTime), start + 1);
      gridStart = Math.min(gridStart, start);
      gridEnd = Math.max(gridEnd, end);
      return { session: s, start, end };
    }).sort((a, b) => a.start - b.start || sessionSeq(a.session) - sessionSeq(b.session));
  });
  gridStart = Math.floor(gridStart / 30) * 30;
  gridEnd = Math.ceil(gridEnd / 30) * 30;
  const slotCount = Math.max(1, (gridEnd - gridStart) / 30);

  // 날짜마다 열 개수(나란한 수업 수)를 정하고, 칸마다 차지하는 행·열 범위를 계산한다.
  // occupied[date][slot][col]: 앞에서 그린 칸이 늘어나 덮고 있는 자리 → 빈 칸을 그리지 않는다
  const columns = {}, startsAt = {}, occupied = {};
  dates.forEach(date => {
    const cols = assignLanes(parsed[date]);
    columns[date] = cols;
    startsAt[date] = {};
    occupied[date] = Array.from({ length: slotCount }, () => new Array(cols).fill(false));
    parsed[date].forEach(it => {
      const rowStart = Math.floor((it.start - gridStart) / 30);
      const rowEnd = Math.min(slotCount, Math.max(rowStart + 1, Math.ceil((it.end - gridStart) / 30)));
      const colStart = Math.floor(it.lane * cols / it.laneCount);
      const colEnd = Math.floor((it.lane + 1) * cols / it.laneCount);
      // 30분 칸에 맞춰 반올림하면서 앞 칸과 겹치는 경우(10:15 끝 → 10:30) 뒤 칸을 그리지 않는다
      if (occupied[date][rowStart][colStart]) return;
      for (let r = rowStart; r < rowEnd; r++) for (let c = colStart; c < colEnd; c++) occupied[date][r][c] = true;
      startsAt[date][`${rowStart}:${colStart}`] = { ...it, rowSpan: rowEnd - rowStart, colSpan: colEnd - colStart };
    });
  });

  const wrap = document.createElement('div');
  wrap.className = 'schedule-table-wrap';
  const table = document.createElement('table');
  table.className = 'schedule-grid workshop-grid';

  // 날짜 열 너비를 똑같이 두고, 나뉜 날짜는 그 안을 다시 똑같이 나눈다(table-layout: fixed)
  const colgroup = document.createElement('colgroup');
  const timeCol = document.createElement('col');
  timeCol.className = 'time-col-width';
  colgroup.appendChild(timeCol);
  dates.forEach(date => {
    for (let c = 0; c < columns[date]; c++) {
      const col = document.createElement('col');
      col.style.width = `${100 / dates.length / columns[date]}%`;
      colgroup.appendChild(col);
    }
  });
  table.appendChild(colgroup);

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
    th.colSpan = columns[date];
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
    timeTd.className = 'time-col' + (mins % 60 ? ' half' : '');
    timeTd.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    tr.appendChild(timeTd);

    dates.forEach(date => {
      for (let c = 0; c < columns[date]; c++) {
        const block = startsAt[date][`${slot}:${c}`];
        if (block) {
          // 칸(td)은 자리만 잡고, 안에 둥근 카드를 채워 카드 사이에 틈을 둔다(테두리 대신 색으로 구분)
          const td = document.createElement('td');
          td.className = 'cell-block';
          td.rowSpan = block.rowSpan;
          td.colSpan = block.colSpan;
          const card = document.createElement('div');
          card.className = 'block';
          card.style.setProperty('--h', toneOf(block.session.className));
          td.appendChild(fillSession(card, block.session, discipline, program, `${block.session.startTime}–${block.session.endTime}`));
          tr.appendChild(td);
          continue;
        }
        if (occupied[date][slot][c]) continue;
        const td = document.createElement('td');
        td.className = 'cell-empty';
        tr.appendChild(td);
      }
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// 모바일에는 스크롤바가 없어 표를 옆으로 밀 수 있다는 단서가 없다.
// 스크롤 여유가 남아 있을 때만 오른쪽 페이드와 안내를 켠다.
function withScrollHint(wrap) {
  const shell = document.createElement('div');
  shell.className = 'scroll-shell';

  const hint = document.createElement('div');
  hint.className = 'scroll-hint';
  hint.textContent = '← 표를 옆으로 밀어 보세요';

  shell.append(hint, wrap);

  const update = () => {
    shell.classList.toggle('has-more', wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft > 4);
  };
  wrap.addEventListener('scroll', () => {
    if (wrap.scrollLeft > 0) shell.classList.add('scrolled');
    update();
  });
  if (window.ResizeObserver) new ResizeObserver(update).observe(wrap);
  requestAnimationFrame(update);

  return shell;
}

/* ---------- 심화 멘토링: 권역(열) × 회차(행) 격자 ---------- */
function buildMentoringGrid(sessions, discipline, program) {
  const regions = Array.from(new Set(sessions.map(s => s.region))).sort((a, b) => a.localeCompare(b, 'ko'));
  const rounds = Array.from(new Set(sessions.map(s => s.round))).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b), 'ko');
  });

  // 같은 권역·회차에 수업이 여럿이면 한 칸에 일자·시간을 붙여 모두 나열한다 (예전에는 첫 수업만 보였음)
  const cellMap = {};
  sessions.forEach(s => {
    const key = `${s.region}__${s.round}`;
    (cellMap[key] = cellMap[key] || []).push(s);
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
      const list = cellMap[`${region}__${round}`];
      if (!list) {
        const td = document.createElement('td');
        td.className = 'cell-empty';
        tr.appendChild(td);
        return;
      }
      if (list.length === 1) {
        tr.appendChild(buildSessionCell(list[0], discipline, program));
        return;
      }
      const items = list
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || sessionSeq(a) - sessionSeq(b))
        .map(session => {
          const { month, day } = formatDateLabel(session.date);
          return { session, label: `${month}.${day} ${session.startTime}–${session.endTime}` };
        });
      tr.appendChild(buildSessionListCell(items, discipline, program));
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
    body.appendChild(withScrollHint(buildWorkshopGrid(sessions, discipline, program)));
  } else if (program === 'mentoring') {
    body.appendChild(withScrollHint(buildMentoringGrid(sessions, discipline, program)));
  } else if (program === 'camp') {
    body.appendChild(buildCampCards(sessions, discipline, program));
  }

  el.append(header, body);
  showView('view-schedule');
  updateDisciplineSwitcher(discipline);
}

registerRoute(/^\/(?<discipline>music|dance|trad|art)\/(?<program>workshop|mentoring|camp)$/, ({ discipline, program }) => renderScheduleView(discipline, program));
