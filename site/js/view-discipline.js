/**
 * 분야 선택 화면. docs/screens.md 3절: STAFF 코드로 로그인한 경우만 거친다
 * (분야 코드는 auth 성공 직후 firstView로 바로 건너뜀, app.js routeFromFirstView).
 * 그 외 사용자도 상단바 분야 전환으로 언제든 이 경로에 닿을 수 있다(docs/decisions.md "분야 이동").
 */
const DISCIPLINE_INFO = {
  music: { name: '음악', english: 'MUSIC', photo: 'images/discipline-music.jpg', color: 'var(--music)' },
  dance: { name: '무용', english: 'BALLET', photo: 'images/discipline-dance.jpg', color: 'var(--dance)' },
  trad: { name: '전통예술', english: 'TRADITIONAL ARTS', photo: 'images/discipline-trad.jpg', color: 'var(--trad)' },
  art: { name: '미술', english: 'ARTS', photo: 'images/discipline-art.jpg', color: 'var(--art)' }
};

// 자료 탭의 학생 작품 행은 세션ID가 비어 분야를 직접 기재한다(docs/sheet-schema.md 3-3절).
function countByDiscipline(slug) {
  const kr = Object.keys(DISCIPLINE_SLUG).find(k => DISCIPLINE_SLUG[k] === slug);
  if (!AppState.data || !kr) return null;
  const sessions = AppState.data.sessions.filter(s => s.discipline === kr);
  const sessionIds = new Set(sessions.map(s => s.sessionId));
  const materialCount = AppState.data.materials.filter(m =>
    (m.sessionId && sessionIds.has(m.sessionId)) || (!m.sessionId && m.discipline === kr)
  ).length;
  return { sessionCount: sessions.length, materialCount };
}

function renderDisciplineView() {
  const el = document.getElementById('view-discipline');
  el.replaceChildren();

  const layout = document.createElement('div');
  layout.className = 'home-layout';

  const text = document.createElement('div');
  text.className = 'home-text';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'hero-eyebrow';
  eyebrow.textContent = '4 DISCIPLINES';
  const title = document.createElement('div');
  title.className = 'hero-title';
  title.textContent = '분야를 선택해 주세요';
  const desc = document.createElement('div');
  desc.className = 'hero-desc';
  desc.textContent = '분야를 고르면 워크숍·심화 멘토링·겨울 심화캠프 자료를 찾아볼 수 있습니다.';
  text.append(eyebrow, title, desc);

  const grid = document.createElement('div');
  grid.className = 'tile-grid';

  Object.entries(DISCIPLINE_INFO).forEach(([slug, info]) => {
    const counts = countByDiscipline(slug);

    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.style.setProperty('--c', info.color);

    const img = document.createElement('img');
    img.src = info.photo;
    img.alt = info.name;

    const scrim = document.createElement('div');
    scrim.className = 'tile-scrim';

    const content = document.createElement('div');
    content.className = 'tile-content';
    const eng = document.createElement('div');
    eng.className = 'tile-eng';
    eng.textContent = info.english;
    const name = document.createElement('div');
    name.className = 'tile-name';
    name.textContent = info.name;
    const meta = document.createElement('div');
    meta.className = 'tile-meta';
    meta.textContent = counts ? `세션 ${counts.sessionCount}개 · 자료 ${counts.materialCount}개` : '불러오는 중…';
    content.append(eng, name, meta);

    tile.append(img, scrim, createBrackets(), content);
    tile.addEventListener('click', () => navigate(`#/${slug}`));
    grid.appendChild(tile);
  });

  layout.append(text, grid);
  el.appendChild(layout);
  showView('view-discipline');
  updateDisciplineSwitcher(null);
}

registerRoute(/^\/$/, renderDisciplineView);
