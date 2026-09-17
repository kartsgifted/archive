/**
 * 프로그램 선택 화면. docs/screens.md 4절: 3개 카드(워크숍·심화 멘토링·겨울 심화캠프).
 * 학생 작품은 프로그램 카드로 두지 않고 검색 → 인물 상세로만 노출한다
 * (docs/decisions.md 3절 "2026-09-17 결정").
 */
const PROGRAM_INFO = [
  { slug: 'workshop', num: '01', name: '워크숍', desc: '일자 × 시간대로 묶인 워크숍 세션' },
  { slug: 'mentoring', num: '02', name: '심화 멘토링', desc: '분야 × 권역 × 회차로 묶인 심화 멘토링' },
  { slug: 'camp', num: '03', name: '겨울 심화캠프', desc: '일자로 묶인 겨울 심화캠프' }
];

function countByProgram(kr, program) {
  if (!AppState.data) return null;
  return AppState.data.sessions.filter(s => s.discipline === kr && s.program === program).length;
}

const PROGRAM_KR = { workshop: '워크숍', mentoring: '심화 멘토링', camp: '겨울 심화캠프' };

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
  title.textContent = `${info.name} · 프로그램을 선택해 주세요`;
  header.append(eyebrow, title);

  const list = document.createElement('div');
  list.className = 'program-list';

  PROGRAM_INFO.forEach(p => {
    const count = countByProgram(Object.keys(DISCIPLINE_SLUG).find(k => DISCIPLINE_SLUG[k] === discipline), PROGRAM_KR[p.slug]);
    const card = document.createElement('div');
    card.className = 'program-card';

    const num = document.createElement('div');
    num.className = 'program-num';
    num.textContent = p.num;

    const body = document.createElement('div');
    body.className = 'program-body';
    const name = document.createElement('div');
    name.className = 'program-name';
    name.textContent = p.name;
    const desc = document.createElement('div');
    desc.className = 'program-desc';
    desc.textContent = count === null ? p.desc : `${p.desc} · 세션 ${count}개`;
    body.append(name, desc);

    const arrow = document.createElement('div');
    arrow.className = 'program-arrow';
    arrow.textContent = '→';

    card.append(num, body, arrow);
    card.addEventListener('click', () => navigate(`#/${discipline}/${p.slug}`));
    list.appendChild(card);
  });

  el.append(header, list);
  showView('view-program');
  updateDisciplineSwitcher(discipline);
}

registerRoute(/^\/(?<discipline>music|dance|trad|art)$/, ({ discipline }) => renderProgramView(discipline));
