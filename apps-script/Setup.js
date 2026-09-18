/**
 * 최초 1회만 실행한다. Apps Script 편집기에서 이 함수를 선택해 ▶ 버튼으로 직접 실행할 것.
 * docs/api.md 5절: 서명 키는 Script Properties에만 둔다 — 이 함수 밖 어디에도 값을 남기지 않는다.
 * 이미 TOKEN_SECRET이 있으면 아무것도 하지 않는다. 실행할 때마다 키가 바뀌면
 * 그 키로 서명된 기존 토큰이 전부 즉시 무효화되기 때문이다.
 */
function setupTokenSecret() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('TOKEN_SECRET')) {
    Logger.log('TOKEN_SECRET이 이미 있어 다시 만들지 않았습니다.');
    return;
  }
  var secret = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('TOKEN_SECRET', secret);
  Logger.log('TOKEN_SECRET을 새로 만들었습니다.');
}

/**
 * 프로그램 시트 3개에 탭·머리글·선택 목록을 만든다 (docs/sheet-schema.md 3절·4절).
 * 머리글 오타는 관문이 오류 없이 빈 값을 읽게 만들므로 손으로 입력하지 않게 하려는 것.
 * Script Properties에 시트 ID 3개를 넣은 뒤 편집기에서 ▶로 한 번 실행한다.
 * 이미 있는 탭은 건드리지 않아 여러 번 실행해도 안전하다.
 */
var PROGRAM_TAB_HEADERS_ = {
  '읽어보기': [],
  '일정': ['세션ID', '분야', '일자', '시작시각', '종료시각', '권역', '회차', '수업명', '강사명', '비고'],
  '자료': ['세션ID', '자료유형', '파일명', '링크', '공개여부', '규격', '학생명', '학생ID', '분야', '비고'],
  '출석부': ['성명', '학생ID'],
  '참여자': ['성명', '학생ID', '세션ID']
};

var PROGRAM_TAB_DROPDOWNS_ = {
  '일정': { '분야': ['음악', '무용', '전통예술', '미술'] },
  '자료': {
    '자료유형': ['영상', '사진', '사진묶음', '작품(영상)', '작품(이미지)'],
    '공개여부': ['검수대기', '공개', '비공개'],
    '분야': ['음악', '무용', '전통예술', '미술']
  }
};

function setupProgramSheets() {
  PROGRAMS_.forEach(function (program) {
    var spreadsheet = getProgramSpreadsheet_(program);
    Object.keys(PROGRAM_TAB_HEADERS_).forEach(function (tabName) {
      if (spreadsheet.getSheetByName(tabName)) {
        Logger.log(program.name + ' › ' + tabName + ': 이미 있어 건드리지 않음');
        return;
      }
      var sheet = spreadsheet.insertSheet(tabName);
      var headers = PROGRAM_TAB_HEADERS_[tabName];
      if (headers.length > 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
      var dropdowns = PROGRAM_TAB_DROPDOWNS_[tabName] || {};
      Object.keys(dropdowns).forEach(function (header) {
        var rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(dropdowns[header], true)
          .setAllowInvalid(false)
          .build();
        sheet.getRange(2, headers.indexOf(header) + 1, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
      });
      Logger.log(program.name + ' › ' + tabName + ': 만듦');
    });
  });
}
