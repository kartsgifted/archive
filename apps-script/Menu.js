/**
 * docs/sheet-schema.md 10절 시트 메뉴. 컨테이너 바인딩 스크립트라 시트를 열면 자동으로 뜬다.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('K예술영재 아카이브')
    .addItem('세션ID 생성', 'generateSessionIds')
    .addItem('출석부 변환', 'convertAttendance')
    .addItem('영상 매칭', 'matchVideos')
    .addSeparator()
    .addItem('점검', 'runInspection')
    .addToUi();
}

// 빠진 값·중복·연결 안 된 자료를 찾는다 (docs/sheet-schema.md 10절).
function runInspection() {
  var issues = [];

  var sessions = sheetRowsAsObjects_('일정');
  var seenIds = {};
  sessions.forEach(function (s, idx) {
    if (!s['세션ID']) {
      issues.push('일정 ' + (idx + 2) + '행: 세션ID가 비어있음');
    } else if (seenIds[s['세션ID']]) {
      issues.push('일정: 세션ID "' + s['세션ID'] + '" 중복');
    } else {
      seenIds[s['세션ID']] = true;
    }
  });

  var isWork = { '작품(영상)': true, '작품(이미지)': true };
  sheetRowsAsObjects_('자료').forEach(function (m, idx) {
    if (isWork[m['자료유형']]) return; // 학생 작품은 세션ID 없어도 정상 (docs/sheet-schema.md 5절)
    if (!m['세션ID']) {
      issues.push('자료 ' + (idx + 2) + '행: 세션ID가 비어있음');
    } else if (!seenIds[m['세션ID']]) {
      issues.push('자료 ' + (idx + 2) + '행: 세션ID "' + m['세션ID'] + '"가 「일정」에 없음');
    }
  });

  var message = issues.length === 0
    ? '문제를 찾지 못했습니다.'
    : issues.slice(0, 30).join('\n') + (issues.length > 30 ? '\n...외 ' + (issues.length - 30) + '건' : '');

  SpreadsheetApp.getUi().alert('점검 결과 (' + issues.length + '건)', message, SpreadsheetApp.getUi().ButtonSet.OK);
}
