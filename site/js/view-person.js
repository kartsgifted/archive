/**
 * 인물 상세 화면. docs/screens.md 8절, docs/decisions.md 3절(2026-09-17 결정):
 * 참여 클래스 + 학생 작품만 보여준다(2026-09-18 결정 — "함께 참여한 인물"은 빼기로 함.
 * 어차피 참여 클래스를 눌러 그 세션 자료 화면으로 들어가면 참여자 칩으로 확인 가능해 중복임).
 * 전부 data 응답(sessions·participants·materials)을 브라우저에서 대조해 계산한다(관문 재요청 없음).
 * key는 학생ID(동명이인 있을 때)나 성명(없을 때)이다(docs/sheet-schema.md 13절).
 */
function findPerson(key) {
  const byId = AppState.data.participants.filter(p => p.studentId && p.studentId === key);
  if (byId.length > 0) return { name: byId[0].name, studentId: key, records: byId };
  const byName = AppState.data.participants.filter(p => p.name === key && !p.studentId);
  if (byName.length > 0) return { name: key, studentId: '', records: byName };
  return null;
}

function buildHistoryRow(session) {
  const row = document.createElement('div');
  row.className = 'history-row';
  const date = document.createElement('div');
  date.className = 'history-date';
  date.textContent = session.date;
  const name = document.createElement('div');
  name.className = 'history-class';
  name.textContent = `${session.discipline} · ${session.program} · ${session.className}`;
  row.append(date, name);
  row.addEventListener('click', () => { const route = sessionRoute(session); if (route) navigate(route); });
  return row;
}

function buildPersonSection(title, node) {
  const section = document.createElement('div');
  section.className = 'person-section';
  const head = document.createElement('div');
  head.className = 'person-section-head';
  head.textContent = title;
  section.append(head, node);
  return section;
}

function renderPersonView(key) {
  const el = document.getElementById('view-person');
  el.replaceChildren();

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'schedule-back-btn';
  back.setAttribute('aria-label', '뒤로 가기');
  back.textContent = '←';
  back.addEventListener('click', () => window.history.back());

  if (!AppState.data) {
    const header = document.createElement('div');
    header.className = 'person-header';
    header.appendChild(back);
    el.append(header, renderMaterialsEmptyState('불러오는 중', '자료를 불러오는 중입니다.'));
    showView('view-person');
    return;
  }

  const person = findPerson(key);
  const header = document.createElement('div');
  header.className = 'person-header';
  header.appendChild(back);

  if (!person) {
    el.append(header, renderMaterialsEmptyState('인물을 찾을 수 없습니다', '검색에서 다시 선택해 주세요.'));
    showView('view-person');
    return;
  }

  const titleWrap = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'person-name';
  name.textContent = person.name;
  titleWrap.appendChild(name);
  if (person.studentId) {
    const sub = document.createElement('div');
    sub.className = 'person-sub';
    sub.textContent = person.studentId;
    titleWrap.appendChild(sub);
  }
  header.appendChild(titleWrap);
  el.appendChild(header);

  const sessionIds = new Set(person.records.map(r => r.sessionId));
  const sessions = AppState.data.sessions
    .filter(s => sessionIds.has(s.sessionId))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  const historyList = document.createElement('div');
  historyList.className = 'history-list';
  sessions.forEach(s => historyList.appendChild(buildHistoryRow(s)));
  el.appendChild(buildPersonSection(`참여 클래스 (${sessions.length})`, historyList));

  const classMaterials = AppState.data.materials.filter(m => sessionIds.has(m.sessionId));
  const classVideoItems = classMaterials.filter(m => m.type === '영상');
  const classPhotoItems = classMaterials.filter(m => m.type === '사진' || m.type === '사진묶음');
  if (classVideoItems.length > 0 || classPhotoItems.length > 0) {
    el.appendChild(buildPersonSection('참여한 클래스 자료', buildMaterialsSection(classVideoItems, classPhotoItems)));
  }

  const artworkVideoItems = AppState.data.materials.filter(m =>
    m.type === '작품(영상)' && m.studentName === person.name && (m.studentId || '') === (person.studentId || ''));
  const artworkPhotoItems = AppState.data.materials.filter(m =>
    m.type === '작품(이미지)' && m.studentName === person.name && (m.studentId || '') === (person.studentId || ''));
  if (artworkVideoItems.length > 0 || artworkPhotoItems.length > 0) {
    el.appendChild(buildPersonSection('학생 작품', buildMaterialsSection(artworkVideoItems, artworkPhotoItems)));
  }

  showView('view-person');
}

registerRoute(/^\/person\/(?<key>[^/]+)$/, ({ key }) => renderPersonView(decodeURIComponent(key)));
