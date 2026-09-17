/**
 * 자료 목록·보기 화면. docs/screens.md 6·7절.
 * - 세션에 속한 자료를 영상 · 사진 탭으로 나열 (작품은 세션ID가 없어 이 화면 대상이 아님, 3.7 인물 상세에서 다룸)
 * - 참여자 칩은 세션 단위로 한 번만 표시 (참여자 탭이 세션ID 단위라 자료별 구분이 없음)
 * - 영상은 화면 안에서 Vimeo로 재생하고 새 탭으로 열지 않는다(도메인 제한이 사이트 밖에서 무력화되므로).
 *   사진은 photo 요청으로 축소본을 받아 확대 표시한다.
 * - 사진묶음(전체 사진 폴더) 열람 방식은 아직 미정이라(docs/decisions.md 9절) 항목만 보여주고 클릭은 막는다.
 */
function renderMaterialsEmptyState(title, note) {
  const wrap = document.createElement('div');
  wrap.className = 'placeholder';
  const h = document.createElement('div');
  h.className = 'placeholder-title';
  h.textContent = title;
  const p = document.createElement('div');
  p.className = 'placeholder-note';
  p.textContent = note;
  wrap.append(h, p);
  return wrap;
}

function buildMaterialItem(material, onOpen) {
  const item = document.createElement('div');
  const isBundle = material.type === '사진묶음';
  item.className = 'material-item' + (isBundle ? ' disabled' : ' clickable');

  const type = document.createElement('div');
  type.className = 'material-type';
  type.textContent = material.type;
  item.appendChild(type);

  const name = document.createElement('div');
  name.className = 'material-name';
  name.textContent = material.fileName || '(파일명 없음)';
  item.appendChild(name);

  if (material.spec) {
    const spec = document.createElement('div');
    spec.className = 'material-spec';
    spec.textContent = material.spec;
    item.appendChild(spec);
  }

  if (isBundle) {
    const pending = document.createElement('div');
    pending.className = 'material-pending';
    pending.textContent = '열람 방식 확인 중';
    item.appendChild(pending);
  } else {
    item.addEventListener('click', () => onOpen(material));
  }

  return item;
}

function renderMaterialsList(container, items, onOpen) {
  container.replaceChildren();
  if (items.length === 0) {
    container.appendChild(renderMaterialsEmptyState('등록된 자료가 없습니다', '아직 업로드된 자료가 없습니다.'));
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'material-list';
  items.forEach(m => grid.appendChild(buildMaterialItem(m, onOpen)));
  container.appendChild(grid);
}

// 영상·사진 자료를 탭(둘 다 있을 때)이나 단일 목록(하나만 있을 때)으로 묶어서 보여준다.
// 자료 목록 화면(세션 단위)과 인물 상세 화면(클래스 자료·학생 작품)이 함께 쓴다.
function buildMaterialsSection(videoItems, photoItems) {
  const wrap = document.createElement('div');
  const listContainer = document.createElement('div');
  // "사진묶음"(전체 폴더)만 확대 대상에서 빼고, 사진 · 작품(이미지)은 모두 확대 가능하다.
  const enlargeablePhotoItems = photoItems.filter(m => m.type !== '사진묶음');

  function showTab(tab) {
    if (tab === 'video') {
      renderMaterialsList(listContainer, videoItems, m => openMaterialModal('video', videoItems, videoItems.indexOf(m)));
    } else {
      renderMaterialsList(listContainer, photoItems, m => {
        if (m.type === '사진묶음') return; // buildMaterialItem에서 이미 클릭을 막지만 한 번 더 방어
        openMaterialModal('photo', enlargeablePhotoItems, enlargeablePhotoItems.indexOf(m));
      });
    }
  }

  if (videoItems.length === 0 && photoItems.length === 0) {
    wrap.appendChild(renderMaterialsEmptyState('등록된 자료가 없습니다', '아직 업로드된 자료가 없습니다.'));
    return wrap;
  }
  if (videoItems.length > 0 && photoItems.length > 0) {
    const tabs = document.createElement('div');
    tabs.className = 'materials-tabs';
    const videoTab = document.createElement('button');
    videoTab.type = 'button';
    videoTab.className = 'materials-tab active';
    videoTab.textContent = `영상 (${videoItems.length})`;
    const photoTab = document.createElement('button');
    photoTab.type = 'button';
    photoTab.className = 'materials-tab';
    photoTab.textContent = `사진 (${photoItems.length})`;
    videoTab.addEventListener('click', () => {
      videoTab.classList.add('active');
      photoTab.classList.remove('active');
      showTab('video');
    });
    photoTab.addEventListener('click', () => {
      photoTab.classList.add('active');
      videoTab.classList.remove('active');
      showTab('photo');
    });
    tabs.append(videoTab, photoTab);
    wrap.append(tabs, listContainer);
    showTab('video');
  } else if (videoItems.length > 0) {
    wrap.appendChild(listContainer);
    showTab('video');
  } else {
    wrap.appendChild(listContainer);
    showTab('photo');
  }
  return wrap;
}

// 「일정」 탭 분야 값(한글) ↔ 프로그램 슬러그로 세션 하나의 라우트를 만든다.
// 검색 결과·인물 상세의 참여 이력에서 공통으로 쓴다.
function sessionRoute(session) {
  const slugEntry = Object.entries(DISCIPLINE_SLUG).find(([kr]) => kr === session.discipline);
  const programInfo = PROGRAM_INFO.find(p => p.name === session.program);
  if (!slugEntry || !programInfo) return null;
  return `#/${slugEntry[1]}/${programInfo.slug}/${session.sessionId}`;
}

/* ---------- 열람 모달 (사이드바 목록 + 가운데 재생·확대, 2026-09-18 결정) ---------- */
const materialModal = {
  el: null, closeBtn: null, eyebrow: null, title: null, videoFrame: null, photoFrame: null,
  sidebarHead: null, sidebarList: null,
  type: null, items: [], index: 0, requestId: 0
};

function initMaterialModal() {
  if (materialModal.el) return;
  materialModal.el = document.getElementById('material-modal');
  materialModal.closeBtn = document.getElementById('material-modal-close');
  materialModal.eyebrow = document.getElementById('material-modal-eyebrow');
  materialModal.title = document.getElementById('material-modal-title');
  materialModal.videoFrame = document.getElementById('material-video-frame');
  materialModal.photoFrame = document.getElementById('material-photo-frame');
  materialModal.sidebarHead = document.getElementById('material-sidebar-head');
  materialModal.sidebarList = document.getElementById('material-sidebar-list');

  materialModal.closeBtn.addEventListener('click', closeMaterialModal);
  materialModal.el.addEventListener('click', e => { if (e.target === materialModal.el) closeMaterialModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !materialModal.el.classList.contains('hidden')) closeMaterialModal(); });
}

function closeMaterialModal() {
  if (!materialModal.el) return;
  materialModal.el.classList.add('hidden');
  materialModal.videoFrame.replaceChildren();
  materialModal.videoFrame.classList.add('hidden');
  materialModal.photoFrame.replaceChildren();
  materialModal.photoFrame.classList.add('hidden');
  materialModal.items = [];
  materialModal.requestId++; // 남아있던 사진 요청 결과를 무시하게 한다
}

function renderMaterialSidebar() {
  materialModal.sidebarHead.textContent = (materialModal.type === 'video' ? '영상 목록' : '사진 목록') + ` (${materialModal.items.length})`;
  materialModal.sidebarList.replaceChildren();
  materialModal.items.forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'sidebar-list-item' + (i === materialModal.index ? ' active' : '');

    const index = document.createElement('div');
    index.className = 'sidebar-list-index';
    index.textContent = String(i + 1).padStart(2, '0');
    item.appendChild(index);

    const label = document.createElement('div');
    label.className = 'sidebar-list-label';
    label.textContent = m.fileName || `${materialModal.type === 'video' ? '영상' : '사진'} ${i + 1}`;
    item.appendChild(label);

    if (materialModal.type === 'video') {
      const play = document.createElement('div');
      play.className = 'sidebar-list-play';
      play.textContent = '▶';
      item.appendChild(play);
    }

    item.addEventListener('click', () => {
      materialModal.index = i;
      renderMaterialSidebar();
      loadMaterialAt(i);
    });
    materialModal.sidebarList.appendChild(item);
  });
}

function loadMaterialAt(index) {
  const material = materialModal.items[index];
  materialModal.requestId++;
  const requestId = materialModal.requestId;

  materialModal.eyebrow.textContent = materialModal.type === 'video' ? '영상' : '사진';
  materialModal.title.textContent = material.fileName || '';

  if (materialModal.type === 'video') {
    materialModal.photoFrame.classList.add('hidden');
    materialModal.photoFrame.replaceChildren();
    materialModal.videoFrame.classList.remove('hidden');
    materialModal.videoFrame.replaceChildren();
    const iframe = document.createElement('iframe');
    iframe.src = `https://player.vimeo.com/video/${encodeURIComponent(material.link)}?title=0&byline=0&portrait=0`;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    materialModal.videoFrame.appendChild(iframe);
    return;
  }

  materialModal.videoFrame.classList.add('hidden');
  materialModal.videoFrame.replaceChildren();
  materialModal.photoFrame.classList.remove('hidden');
  materialModal.photoFrame.replaceChildren();
  const status = document.createElement('div');
  status.className = 'photo-frame-status';
  status.textContent = '불러오는 중…';
  materialModal.photoFrame.appendChild(status);

  api.photo(getToken(), material.link).then(res => {
    if (requestId !== materialModal.requestId) return; // 그 사이 다른 사진을 골랐거나 모달을 닫았음
    materialModal.photoFrame.replaceChildren();
    const img = document.createElement('img');
    img.src = `data:${res.mimeType};base64,${res.base64}`;
    img.alt = material.fileName || '';
    materialModal.photoFrame.appendChild(img);
  }).catch(() => {
    if (requestId !== materialModal.requestId) return;
    materialModal.photoFrame.replaceChildren();
    const err = document.createElement('div');
    err.className = 'photo-frame-status';
    err.textContent = '사진을 불러오지 못했습니다.';
    materialModal.photoFrame.appendChild(err);
  });
}

function openMaterialModal(type, items, startIndex) {
  initMaterialModal();
  materialModal.type = type;
  materialModal.items = items;
  materialModal.index = startIndex >= 0 ? startIndex : 0;
  renderMaterialSidebar();
  loadMaterialAt(materialModal.index);
  materialModal.el.classList.remove('hidden');
}

/* ---------- 화면 진입 ---------- */
function renderMaterialsView(discipline, program, sessionId) {
  const disciplineInfo = DISCIPLINE_INFO[discipline];
  const disciplineKr = Object.keys(DISCIPLINE_SLUG).find(k => DISCIPLINE_SLUG[k] === discipline);
  const programInfo = PROGRAM_INFO.find(p => p.slug === program);
  if (!disciplineInfo || !programInfo) { navigate('#/'); return; }

  const el = document.getElementById('view-materials');
  el.replaceChildren();

  if (!AppState.data) {
    el.appendChild(renderMaterialsEmptyState('불러오는 중', '자료를 불러오는 중입니다.'));
    showView('view-materials');
    updateDisciplineSwitcher(discipline);
    return;
  }

  const session = AppState.data.sessions.find(s => s.sessionId === sessionId && s.discipline === disciplineKr && s.program === programInfo.name);

  // 일정표뿐 아니라 인물 상세의 "참여 클래스"·검색의 "수업"에서도 들어올 수 있어
  // 항상 일정표로 고정하지 않고, 실제 들어온 경로로 돌아가게 브라우저 히스토리를 따른다.
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'schedule-back-btn';
  back.setAttribute('aria-label', '뒤로 가기');
  back.textContent = '←';
  back.addEventListener('click', () => window.history.back());

  if (!session) {
    const header = document.createElement('div');
    header.className = 'materials-header';
    header.append(back);
    el.append(header, renderMaterialsEmptyState('세션을 찾을 수 없습니다', '일정표에서 다시 선택해 주세요.'));
    showView('view-materials');
    updateDisciplineSwitcher(discipline);
    return;
  }

  const { location } = parseNote(session.note);
  const header = document.createElement('div');
  header.className = 'materials-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'materials-title-wrap';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'materials-eyebrow';
  eyebrow.textContent = `${session.date} · ${session.startTime}–${session.endTime}`;
  const title = document.createElement('div');
  title.className = 'materials-title';
  title.textContent = session.className;
  const sub = document.createElement('div');
  sub.className = 'materials-sub';
  sub.textContent = [session.instructor, location].filter(Boolean).join(' · ');
  titleWrap.append(eyebrow, title, sub);
  header.append(back, titleWrap);

  const participants = AppState.data.participants.filter(p => p.sessionId === sessionId);
  const participantsWrap = document.createElement('div');
  participantsWrap.className = 'materials-participants';
  participants.forEach(p => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'participant-chip';
    chip.textContent = p.name;
    chip.addEventListener('click', () => navigate(`#/person/${encodeURIComponent(p.studentId || p.name)}`));
    participantsWrap.appendChild(chip);
  });

  const materials = AppState.data.materials.filter(m => m.sessionId === sessionId);
  const videoItems = materials.filter(m => m.type === '영상');
  const photoItems = materials.filter(m => m.type === '사진' || m.type === '사진묶음');

  el.append(header);
  if (participants.length > 0) el.append(participantsWrap);
  el.appendChild(buildMaterialsSection(videoItems, photoItems));

  showView('view-materials');
  updateDisciplineSwitcher(discipline);
}

registerRoute(/^\/(?<discipline>music|dance|trad|art)\/(?<program>workshop|mentoring|camp)\/(?<sessionId>[^/]+)$/, ({ discipline, program, sessionId }) => renderMaterialsView(discipline, program, decodeURIComponent(sessionId)));
