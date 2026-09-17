/**
 * 프로그램 선택 화면. docs/screens.md 4절: 3개 카드(워크숍·심화 멘토링·겨울 심화캠프).
 * 학생 작품은 프로그램 카드로 두지 않고 검색 → 인물 상세로만 노출한다
 * (docs/decisions.md 3절 "2026-09-17 결정").
 */
// images/program-*.jpg는 아직 실제 프로그램 사진이 없어 분야 사진을 복사해 둔 자리표시용이다.
// 실제 사진을 받으면 같은 이름으로 덮어쓰면 된다(코드 수정 불필요).
const PROGRAM_INFO = [
  { slug: 'workshop', name: '워크숍', english: 'WORKSHOP', photo: 'images/program-workshop.jpg' },
  { slug: 'mentoring', name: '심화 멘토링', english: 'MENTORING', photo: 'images/program-mentoring.jpg' },
  { slug: 'camp', name: '겨울 심화캠프', english: 'WINTER CAMP', photo: 'images/program-camp.jpg' }
];

function renderProgramView(discipline) {
  const info = DISCIPLINE_INFO[discipline];
  if (!info) { navigate('#/'); return; }

  const el = document.getElementById('view-program');
  el.replaceChildren();

  const header = document.createElement('div');
  header.className = 'program-header';
  header.style.setProperty('--c', info.color);
  const eyebrow = document.createElement('div');
  eyebrow.className = 'hero-eyebrow program-eyebrow';
  eyebrow.textContent = info.english;
  const title = document.createElement('div');
  title.className = 'hero-title';
  title.textContent = '프로그램을 선택해 주세요';
  header.append(eyebrow, title);

  const grid = document.createElement('div');
  grid.className = 'program-grid';

  PROGRAM_INFO.forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.style.setProperty('--c', info.color);

    const img = document.createElement('img');
    img.src = p.photo;
    img.alt = '';

    const scrim = document.createElement('div');
    scrim.className = 'tile-scrim';

    const content = document.createElement('div');
    content.className = 'tile-content';
    const eng = document.createElement('div');
    eng.className = 'tile-eng';
    eng.textContent = p.english;
    const name = document.createElement('div');
    name.className = 'tile-name';
    name.textContent = p.name;
    content.append(eng, name);

    tile.append(img, scrim, createBrackets(), content);
    tile.addEventListener('click', () => navigate(`#/${discipline}/${p.slug}`));
    grid.appendChild(tile);
  });

  el.append(header, grid);
  showView('view-program');
  updateDisciplineSwitcher(discipline);
}

registerRoute(/^\/(?<discipline>music|dance|trad|art)$/, ({ discipline }) => renderProgramView(discipline));
