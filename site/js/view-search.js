/**
 * 상시 검색 결과 화면. docs/screens.md 8절.
 * data 응답의 sessions·participants·materials를 브라우저에서 필터링한다(관문 재요청 없음).
 * 결과는 사람 · 수업으로 구분한다. 학생 작품은 학생 이름으로 찾으므로 "사람"(→ 인물 상세의 「학생 작품」)으로
 * 이어진다(2026-10-08). 동명이인은 studentId가 다르면 서로 다른 사람으로 잡혀 "사람" 목록에
 * 별도 항목으로 나뉘어 뜬다(docs/sheet-schema.md 13절).
 */
// 이름이 하나로 특정되는 학생 검색은 인물 상세로 바로 보내므로(renderSearchView),
// 여기서는 분야·수업명·교강사·장소만 본다. 학생 이름으로 걸리는 수업은 인물 상세의
// "참여 클래스"에서 보여준다(2026-09-18 결정).
function searchSessions(q) {
  return AppState.data.sessions.filter(s => {
    const { location } = parseNote(s.note);
    return [s.discipline, s.className, s.instructor, location].some(v => v && v.toLowerCase().includes(q));
  });
}

function isArtworkMaterial(m) {
  return m.type === '작품(영상)' || m.type === '작품(이미지)';
}

// 사람은 「참여자」와 학생 작품의 학생명에서 함께 찾는다. 출석부가 아직 없어 작품만 있는
// 학생도 같은 방식(한 명이면 인물 상세로 바로, 여럿이면 목록)으로 찾게 하기 위함(2026-10-08).
// 같은 사람은 학생ID(동명이인일 때) 또는 이름으로 하나로 묶인다.
function searchPeople(q) {
  const map = new Map();
  const add = (name, studentId) => {
    if (!name || !name.toLowerCase().includes(q)) return;
    const key = studentId || name;
    if (!map.has(key)) map.set(key, { name, studentId, key });
  };
  AppState.data.participants.forEach(p => add(p.name, p.studentId));
  AppState.data.materials.forEach(m => { if (isArtworkMaterial(m)) add(m.studentName, m.studentId); });
  return [...map.values()];
}

function buildSearchRow(main, sub, onClick) {
  const row = document.createElement('div');
  row.className = 'search-result-row';
  const mainEl = document.createElement('div');
  mainEl.className = 'search-result-main';
  mainEl.textContent = main;
  const subEl = document.createElement('div');
  subEl.className = 'search-result-sub';
  subEl.textContent = sub;
  row.append(mainEl, subEl);
  row.addEventListener('click', onClick);
  return row;
}

function buildSearchSection(title, rows) {
  const section = document.createElement('div');
  section.className = 'search-section';
  const head = document.createElement('div');
  head.className = 'search-section-head';
  head.textContent = `${title} (${rows.length})`;
  section.appendChild(head);

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'placeholder-note';
    empty.textContent = '검색 결과가 없습니다.';
    section.appendChild(empty);
    return section;
  }
  const list = document.createElement('div');
  list.className = 'search-result-list';
  rows.forEach(r => list.appendChild(r));
  section.appendChild(list);
  return section;
}

function renderSearchView(query) {
  const el = document.getElementById('view-search');
  el.replaceChildren();

  if (!AppState.data) {
    const header = document.createElement('div');
    header.className = 'materials-header';
    const title = document.createElement('div');
    title.className = 'materials-title';
    title.textContent = query ? `"${query}" 검색 결과` : '검색';
    header.appendChild(title);
    el.append(header, renderMaterialsEmptyState('불러오는 중', '자료를 불러오는 중입니다.'));
    showView('view-search');
    return;
  }
  if (!query.trim()) {
    const header = document.createElement('div');
    header.className = 'materials-header';
    const title = document.createElement('div');
    title.className = 'materials-title';
    title.textContent = '검색';
    header.appendChild(title);
    el.append(header, renderMaterialsEmptyState('검색어를 입력해 주세요', '분야 · 활동명 · 수업명 · 교강사 · 학생 · 장소로 찾을 수 있습니다.'));
    showView('view-search');
    return;
  }

  const q = query.trim().toLowerCase();
  const people = searchPeople(q);

  // 학생 이름이 한 명으로 특정되면 검색 결과 화면을 거치지 않고 바로 인물 상세로 보낸다
  // (2026-09-18 결정). 뒤로가기를 눌렀을 때 검색 화면으로 돌아왔다가 다시 튕기지 않도록
  // 현재 히스토리 항목을 인물 상세 주소로 교체한다.
  if (people.length === 1) {
    history.replaceState(null, '', `#/person/${encodeURIComponent(people[0].key)}`);
    renderPersonView(people[0].key);
    return;
  }

  const header = document.createElement('div');
  header.className = 'materials-header';
  const title = document.createElement('div');
  title.className = 'materials-title';
  title.textContent = `"${query}" 검색 결과`;
  header.appendChild(title);
  el.appendChild(header);

  // 동명이인 등 이름이 여러 명과 겹치면, 엉뚱한 사람의 수업·작품과 섞이지 않도록
  // "사람" 목록만 보여주고 고르게 한다(docs/sheet-schema.md 13절).
  if (people.length > 1) {
    const peopleRows = people.map(p => buildSearchRow(
      p.name + (p.studentId ? ` (${p.studentId})` : ''),
      '인물',
      () => {
        history.replaceState(null, '', `#/person/${encodeURIComponent(p.key)}`);
        renderPersonView(p.key);
      }
    ));
    el.appendChild(buildSearchSection('사람', peopleRows));
    showView('view-search');
    return;
  }

  // 이름이 하나도 안 걸린 경우. 학생 작품은 학생 이름으로만 찾으므로 위의 "사람"에서 이미
  // 인물 상세로 이어지고(작품은 인물 상세의 「학생 작품」에 나옴), 여기서는 수업만 남는다.
  const sessions = searchSessions(q);

  if (sessions.length === 0) {
    el.appendChild(renderMaterialsEmptyState('검색 결과가 없습니다', '분야 · 활동명 · 수업명 · 교강사 · 학생 · 장소로 다시 찾아보세요.'));
    showView('view-search');
    return;
  }

  const sessionRows = sessions.map(s => buildSearchRow(
    s.className,
    `${s.discipline} · ${s.program} · ${s.date}`,
    () => { const route = sessionRoute(s); if (route) navigate(route); }
  ));
  el.appendChild(buildSearchSection('수업', sessionRows));
  showView('view-search');
}

registerRoute(/^\/search\/?(?<query>.*)$/, ({ query }) => renderSearchView(decodeURIComponent(query || '')));
