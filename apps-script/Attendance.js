/**
 * [출석부 변환] 메뉴. docs/sheet-schema.md 3-4: 가로=수업, 세로=성명인 「출석부」를
 * 「참여자」(성명·세션ID) 탭으로 바꾼다. 출석 표시 기호의 정확한 규격은 "확인 필요"
 * (기존 출석부 파일 확인 후 확정)라, 지금은 "칸이 비어있지 않으면 출석"으로 처리한다.
 */

function convertAttendance() {
  var attendanceValues = getSheet_('출석부').getDataRange().getValues();
  if (attendanceValues.length < 2) return;

  var headerRow = attendanceValues[0];
  var sessions = sheetRowsAsObjects_('일정');
  var sessionIds = headerRow.slice(1).map(function (h) { return resolveSessionId_(h, sessions); });

  var participants = [];
  for (var r = 1; r < attendanceValues.length; r++) {
    var name = attendanceValues[r][0];
    if (!name) continue;
    for (var c = 1; c < attendanceValues[r].length; c++) {
      var mark = attendanceValues[r][c];
      var sessionId = sessionIds[c - 1];
      if (mark !== '' && mark != null && sessionId) {
        participants.push([sanitizeForSheet_(name), sanitizeForSheet_(sessionId)]);
      }
    }
  }

  var participantSheet = getSheet_('참여자');
  ensureParticipantHeaders_(participantSheet);

  var lastRow = participantSheet.getLastRow();
  if (lastRow > 1) {
    participantSheet.getRange(2, 1, lastRow - 1, 2).clearContent();
  }
  if (participants.length > 0) {
    participantSheet.getRange(2, 1, participants.length, 2).setValues(participants);
  }
}

// 헤더가 이미 세션ID면 그대로 쓰고, 아니면 수업명으로 보고 「일정」에서 찾는다.
function resolveSessionId_(header, sessions) {
  if (!header) return null;
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i]['세션ID'] === header) return header;
  }
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i]['수업명'] === header) return sessions[i]['세션ID'];
  }
  return null; // 못 찾으면 무시한다 — [점검]에서 드러남
}

function ensureParticipantHeaders_(sheet) {
  var first = sheet.getRange(1, 1, 1, 2).getValues()[0];
  if (!first[0] && !first[1]) {
    sheet.getRange(1, 1, 1, 2).setValues([['성명', '세션ID']]);
  }
}
