/**
 * [세션ID 생성] 메뉴. docs/sheet-schema.md 7절: 분야·일자·시작시각을 넣으면 자동 생성, 직접 입력 금지.
 *
 * 형식(세 프로그램 공통, 2026-10-02 개정): {연도}-{프로그램코드}-{분야코드}-{MMDD}-{HHMM}-{순번}
 *   예: 26-ws-music-0807-1000-1 / 26-mt-music-1015-1400-1 / 26-camp-music-0115-1000-1
 * 연도는 달력 연도가 아니라 공통 시트 「설정」의 사업연도다 — 2027년 1월 캠프도 2026 사업이면 26.
 * 순번은 같은 분야·일자·시작시각 안에서 매긴다. 행 순서로 세지 않고 "이미 있는 같은 묶음 ID의 가장 큰 순번 + 1"을 쓴다 —
 * 영상 새 이름에 이미 쓰인 ID(대응표에서 붙여 넣은 「일정」, 2026-10-07)와 겹치지 않게 하고, 행을 옮기거나 지워도 순번이 꼬이지 않게.
 * 이미 세션ID가 있는 행은 건드리지 않는다. 분야·일자·시작시각 중 하나라도 비었으면 건너뛴다.
 */

var DISCIPLINE_CODE_ = { '음악': 'music', '무용': 'dance', '전통예술': 'trad', '미술': 'art' };

function generateSessionIdsFor_(program) {
  var year = businessYearPrefix_();
  var sheet = getSheet_('일정', program);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  // 1) 이미 있는 ID에서 묶음별 가장 큰 순번을 모은다 (개정 전 형식 ID는 형식이 달라 자연히 빠진다)
  var maxSeq = {};
  for (var i = 1; i < values.length; i++) {
    var m = String(values[i][col['세션ID']] || '').trim().match(/^(.+)-(\d+)$/);
    if (m) maxSeq[m[1]] = Math.max(maxSeq[m[1]] || 0, Number(m[2]));
  }

  // 2) ID가 없는 행에 위에서부터 순서대로 다음 순번을 준다
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join('') === '') continue;
    if (String(row[col['세션ID']] || '').trim()) continue; // 이미 있으면 유지

    var key = sessionGroupKey_(program, year, row[col['분야']], row[col['일자']], row[col['시작시각']]);
    if (!key) continue;

    maxSeq[key] = (maxSeq[key] || 0) + 1;
    sheet.getRange(r + 1, col['세션ID'] + 1).setValue(key + '-' + maxSeq[key]);
  }
}

// 「설정」의 사업연도(예: 2026) → "26". 값이 없으면 잘못된 ID를 만드느니 멈춘다.
function businessYearPrefix_() {
  var raw = String(getSetting_('사업연도', '')).trim();
  if (!/^\d{4}$/.test(raw)) {
    throw new Error('공통 시트 「설정」 탭에 사업연도(예: 2026)를 넣어 주세요 (docs/sheet-schema.md 3-7)');
  }
  return raw.slice(2);
}

// 순번을 뺀 앞부분: {연도}-{프로그램코드}-{분야코드}-{MMDD}-{HHMM}. 값이 모자라거나 형식이 다르면 null(그 행은 건너뜀)
function sessionGroupKey_(program, year, discipline, date, startTime) {
  var disciplineCode = DISCIPLINE_CODE_[String(discipline || '').trim()];
  if (!disciplineCode) return null;

  var d = formatDateCell_(date).trim().match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!d) return null;

  var t = formatTimeCell_(startTime).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!t) return null;
  var hhmm = ('0' + t[1]).slice(-2) + t[2];

  return [year, program.code, disciplineCode, d[1] + d[2], hhmm].join('-');
}
