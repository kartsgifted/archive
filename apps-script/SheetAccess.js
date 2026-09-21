/**
 * 자료 관리 시트 접근 공통 함수. docs/sheet-schema.md 2절: 공통 시트 1 + 프로그램 시트 3.
 * 공통 시트는 이 스크립트가 붙어 있는 시트라 getActiveSpreadsheet()로 연다(웹앱 실행 중에도 동일).
 * 프로그램 시트는 Script Properties에 둔 ID로 연다(docs/sheet-schema.md 14절).
 */

var PROGRAMS_ = [
  { name: '워크숍', code: 'ws', prop: 'SHEET_ID_WORKSHOP' },
  { name: '심화 멘토링', code: 'mt', prop: 'SHEET_ID_MENTORING' },
  { name: '겨울 심화캠프', code: 'camp', prop: 'SHEET_ID_CAMP' }
];

// openById는 호출마다 수백 ms가 걸려, 한 번의 실행 안에서는 연 시트를 재사용한다.
var openedProgramSpreadsheets_ = {};

function getProgram_(code) {
  for (var i = 0; i < PROGRAMS_.length; i++) {
    if (PROGRAMS_[i].code === code) return PROGRAMS_[i];
  }
  throw new Error('알 수 없는 프로그램: ' + code);
}

function getProgramSpreadsheet_(program) {
  if (!openedProgramSpreadsheets_[program.code]) {
    var id = PropertiesService.getScriptProperties().getProperty(program.prop);
    if (!id) throw new Error('스크립트 속성 ' + program.prop + '가 없음 — ' + program.name + ' 시트 ID를 넣을 것 (docs/sheet-schema.md 14절)');
    openedProgramSpreadsheets_[program.code] = SpreadsheetApp.openById(id);
  }
  return openedProgramSpreadsheets_[program.code];
}

// program을 생략하면 공통 시트의 탭을 찾는다.
function getSheet_(name, program) {
  var spreadsheet = program ? getProgramSpreadsheet_(program) : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('시트를 찾을 수 없음: ' + (program ? program.name + ' › ' : '') + name);
  return sheet;
}

// 첫 행을 헤더로 삼아 각 행을 { 헤더명: 값 } 객체로 반환한다. 빈 행은 건너뛴다.
function sheetRowsAsObjects_(sheetName, program) {
  var values = getSheet_(sheetName, program).getDataRange().getValues();
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

// 「코드」 탭은 auth·ping·data 모든 요청이 읽으므로 캐시에서 본다 (docs/decisions.md 9절).
// 사용기한은 캐시에 담기 전에 문자열로 바꾼다 — Date를 JSON에 넣으면 형식이 달라져
// isWithinExpiry_가 해석하지 못하고 기한이 지난 것으로 판단한다.
function findCodeRow_(code) {
  var rows = cached_('codes', function () {
    return sheetRowsAsObjects_('코드').map(function (row) {
      row['사용기한'] = formatDateCell_(row['사용기한']);
      return row;
    });
  });
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
    // 캐시를 거친 값은 "2027-03-31T00:00:00.000Z"처럼 올 수 있어 날짜 부분만 쓴다.
    expiry = new Date(String(expiryValue).slice(0, 10) + 'T23:59:59+09:00');
  }
  return Date.now() <= expiry.getTime();
}
