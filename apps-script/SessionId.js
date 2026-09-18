/**
 * [세션ID 생성] 메뉴. docs/sheet-schema.md 7절: 분야·일자·시간대를 넣으면 자동 생성, 직접 입력 금지.
 *
 * 형식: {연도}-ws-{분야코드}-{MMDD}-{순번}      (워크숍)
 *      {연도}-mt-{분야코드}-{권역}-{회차}       (심화 멘토링)
 *      {연도}-camp-{분야코드}-{MMDD}-{순번}    (겨울 심화캠프)
 * 연도는 달력 연도가 아니라 공통 시트 「설정」의 사업연도다 — 2027년 1월 캠프도 2026 사업이면 26.
 * 이미 세션ID가 있는 행은 건드리지 않는다.
 */

var DISCIPLINE_CODE_ = { '음악': 'music', '무용': 'dance', '전통예술': 'trad', '미술': 'art' };

function generateSessionIdsFor_(program) {
  var year = businessYearPrefix_();
  var sheet = getSheet_('일정', program);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var isMentoring = program.code === 'mt';
  var seqCount = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;

    var key = sessionGroupKey_(program, year, row[col['분야']], row[col['일자']], row[col['권역']], row[col['회차']]);
    if (!key) continue;

    if (!isMentoring) seqCount[key] = (seqCount[key] || 0) + 1;

    if (row[col['세션ID']]) continue; // 이미 있으면 유지

    var newId = isMentoring ? key : (key + '-' + seqCount[key]);
    sheet.getRange(i + 1, col['세션ID'] + 1).setValue(newId);
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

// docs/sheet-schema.md 7절 "묶는 기준": 워크숍=일자×시간대 / 멘토링=분야×권역×회차 / 캠프=일자
function sessionGroupKey_(program, year, discipline, date, region, round) {
  var disciplineCode = DISCIPLINE_CODE_[discipline];
  if (!disciplineCode) return null;
  var prefix = year + '-' + program.code + '-' + disciplineCode;

  if (program.code === 'mt') {
    if (!region || !round) return null;
    return prefix + '-' + region + '-' + round;
  }

  var mmdd = formatDateCell_(date).replace(/-/g, '').slice(4);
  if (!mmdd) return null;
  return prefix + '-' + mmdd;
}
