/**
 * [영상 매칭] 메뉴. docs/sheet-schema.md 9절 파일명 규칙(20261015_1330_음악_A.mp4)을
 * 적용해 「자료」 탭에서 세션ID가 빈 행을 「일정」과 자동으로 연결한다.
 *
 * 문서에 나온 "기촬영분은 업로드 일시와 재생 시간을 대조해 초벌 연결" 방식(드라이브 메타데이터·
 * 영상 길이 대조)은 여기서 구현하지 않았다 — 문서 자체가 "향후 촬영분부터 적용"이라고 못박은
 * 신규 규칙이고, 과거 영상은 대조 기준이 불명확해 사람이 검수하며 연결해야 한다.
 *
 * 파일명에는 프로그램이 없어, 메뉴에서 고른 프로그램 시트 안에서만 일정을 찾는다.
 */

function matchVideosFor_(program) {
  var sheet = getSheet_('자료', program);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var sessions = sheetRowsAsObjects_('일정', program);

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;
    if (row[col['세션ID']]) continue;

    var parsed = parseVideoFileName_(row[col['파일명']]);
    if (!parsed) continue;

    var match = findMatchingSession_(sessions, parsed);
    if (match) {
      sheet.getRange(i + 1, col['세션ID'] + 1).setValue(match['세션ID']);
    }
  }
}

// "20261015_1330_음악_A.mp4" → { date:'2026-10-15', time:'13:30', discipline:'음악' }
function parseVideoFileName_(fileName) {
  if (!fileName) return null;
  var m = String(fileName).match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})_([^_]+)_/);
  if (!m) return null;
  return { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] + ':' + m[5], discipline: m[6] };
}

function findMatchingSession_(sessions, parsed) {
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    if (formatDateCell_(s['일자']) === parsed.date &&
        s['분야'] === parsed.discipline &&
        parsed.time >= formatTimeCell_(s['시작시각']) &&
        parsed.time <= formatTimeCell_(s['종료시각'])) {
      return s;
    }
  }
  return null;
}
