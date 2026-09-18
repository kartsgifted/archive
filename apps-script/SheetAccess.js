/**
 * 자료 관리 시트 접근 공통 함수. 컨테이너 바인딩 스크립트라
 * SpreadsheetApp.getActiveSpreadsheet()가 실행 방식과 무관하게 이 시트를 반환한다.
 */

function getSheet_(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('시트를 찾을 수 없음: ' + name);
  return sheet;
}

// 첫 행을 헤더로 삼아 각 행을 { 헤더명: 값 } 객체로 반환한다. 빈 행은 건너뛴다.
function sheetRowsAsObjects_(sheetName) {
  var values = getSheet_(sheetName).getDataRange().getValues();
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    rows.push(obj);
  }
  return rows;
}

function findCodeRow_(code) {
  var rows = sheetRowsAsObjects_('코드');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i]['코드'] === code) return rows[i];
  }
  return null;
}

// 시트가 "2026-07-17" 같은 값을 자동으로 Date로 바꿔두는 경우와 문자열로 남아있는 경우를 모두 처리한다.
function formatDateCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value == null ? '' : value);
}

function formatTimeCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(value == null ? '' : value);
}

// 사용기한(문자열 또는 시트가 자동 변환한 Date)이 오늘을 포함해 지나지 않았는지 확인한다.
function isWithinExpiry_(expiryValue) {
  var expiry;
  if (Object.prototype.toString.call(expiryValue) === '[object Date]') {
    expiry = new Date(expiryValue.getFullYear(), expiryValue.getMonth(), expiryValue.getDate(), 23, 59, 59);
  } else {
    expiry = new Date(String(expiryValue) + 'T23:59:59+09:00');
  }
  return Date.now() <= expiry.getTime();
}
