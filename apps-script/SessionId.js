/**
 * [세션ID 생성] 메뉴. docs/sheet-schema.md 7절: 분야·일자·시간대를 넣으면 자동 생성,
 * 직접 입력 금지. 정확한 표기 형식은 문서에 없어 아래처럼 정했다 — 다른 방식을 원하면 조정.
 *
 * 형식: {분야코드}-{MMDD}-{순번}            (워크숍)
 *      {분야코드}-{권역}-{회차}             (심화 멘토링)
 *      {분야코드}-camp-{MMDD}-{순번}        (겨울 심화캠프)
 * 이미 세션ID가 있는 행은 건드리지 않는다.
 */

var DISCIPLINE_CODE_ = { '음악': 'music', '무용': 'dance', '전통예술': 'trad', '미술': 'art' };

function generateSessionIds() {
  var sheet = getSheet_('일정');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var seqCount = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;

    var key = sessionGroupKey_(
      row[col['프로그램']],
      row[col['분야']],
      row[col['일자']],
      row[col['권역']],
      row[col['회차']]
    );
    if (!key) continue;

    var isMentoring = row[col['프로그램']] === '심화 멘토링';
    if (!isMentoring) seqCount[key] = (seqCount[key] || 0) + 1;

    if (row[col['세션ID']]) continue; // 이미 있으면 유지

    var newId = isMentoring ? key : (key + '-' + seqCount[key]);
    sheet.getRange(i + 1, col['세션ID'] + 1).setValue(newId);
  }
}

// docs/sheet-schema.md 7절 "묶는 기준": 워크숍=일자×시간대 / 멘토링=분야×권역×회차 / 캠프=일자
function sessionGroupKey_(program, discipline, date, region, round) {
  var code = DISCIPLINE_CODE_[discipline];
  if (!code) return null;

  if (program === '심화 멘토링') {
    if (!region || !round) return null;
    return code + '-' + region + '-' + round;
  }

  var mmdd = formatDateCell_(date).replace(/-/g, '').slice(4);
  if (!mmdd) return null;

  if (program === '겨울 심화캠프') return code + '-camp-' + mmdd;
  return code + '-' + mmdd; // 워크숍(기본값)
}
