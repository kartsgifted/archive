/**
 * 1회용: 시트 분리 전 공통 시트에 있던 「일정」·「자료」·「출석부」를 프로그램 시트로 옮긴다
 * (docs/sheet-schema.md 2절). 옮기면서 새 형식 세션ID를 부여하고, 「자료」의 세션ID와
 * 「출석부」 머리글을 새 ID로 바꾼 뒤 [출석부 변환]까지 실행한다.
 *
 * 편집기에서 migrateLegacyTabs를 ▶로 실행한다. 공통 시트의 옛 탭은 지우지 않는다.
 * 프로그램 시트에 이미 데이터가 있으면 아무것도 하지 않는다(중복 방지).
 * 이전이 끝나면 이 파일은 지워도 된다.
 */
function migrateLegacyTabs() {
  PROGRAMS_.forEach(function (program) {
    ['일정', '자료', '출석부'].forEach(function (tab) {
      if (getSheet_(tab, program).getLastRow() > 1) {
        throw new Error(program.name + ' › ' + tab + '에 이미 데이터가 있어 멈춤 — 이전은 빈 시트에만 한다');
      }
    });
  });

  var legacySessions = sheetRowsAsObjects_('일정');
  var idMap = migrateSessions_(legacySessions);
  migrateMaterials_(idMap);
  var touched = migrateAttendance_(legacySessions, idMap);
  touched.forEach(function (program) { convertAttendanceFor_(program); });

  Logger.log('완료. 사이트 배포 후 공통 시트의 옛 「일정」·「자료」·「출석부」·「참여자」 탭을 확인하고 지울 것');
}

// 반환: { 옛 세션ID: { program, newId } }
function migrateSessions_(legacySessions) {
  var headers = PROGRAM_TAB_HEADERS_['일정'];
  var byProgram = {};
  legacySessions.forEach(function (row, idx) {
    var program = findProgramByName_(row['프로그램']);
    if (!program) throw new Error('공통 시트 일정 ' + (idx + 2) + '행: 프로그램 값을 알 수 없음 "' + row['프로그램'] + '"');
    (byProgram[program.code] = byProgram[program.code] || []).push(row);
  });

  var idMap = {};
  PROGRAMS_.forEach(function (program) {
    var rows = byProgram[program.code];
    if (!rows) return;

    var sheet = getSheet_('일정', program);
    var values = rows.map(function (row, i) {
      var out = headers.map(function (h) { return h === '세션ID' ? '' : copyableValue_(row[h]); });
      return fitDropdowns_('일정', out, program.name + ' › 일정 ' + (i + 2) + '행');
    });
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
    SpreadsheetApp.flush();

    generateSessionIdsFor_(program);
    SpreadsheetApp.flush();

    var newIds = sheet.getRange(2, 1, values.length, 1).getValues();
    rows.forEach(function (row, i) {
      var oldId = row['세션ID'];
      var newId = newIds[i][0];
      if (oldId && newId) idMap[oldId] = { program: program, newId: newId };
      if (!newId) Logger.log(program.name + ' › 일정 ' + (i + 2) + '행: 세션ID를 만들지 못함 (분야·일자 등 확인)');
    });
    Logger.log(program.name + ' › 일정 ' + rows.length + '행 옮김');
  });
  return idMap;
}

function migrateMaterials_(idMap) {
  var headers = PROGRAM_TAB_HEADERS_['자료'];
  var byProgram = {};
  sheetRowsAsObjects_('자료').forEach(function (row, idx) {
    var target = idMap[row['세션ID']];
    if (!target) {
      // 학생 작품처럼 세션ID가 없거나, 옛 일정에 없는 ID면 소속 시트를 알 수 없다.
      Logger.log('공통 시트 자료 ' + (idx + 2) + '행: 소속 프로그램을 알 수 없어 옮기지 않음 — 직접 옮길 것');
      return;
    }
    var values = headers.map(function (h) { return h === '세션ID' ? target.newId : copyableValue_(row[h]); });
    fitDropdowns_('자료', values, '공통 시트 자료 ' + (idx + 2) + '행');
    (byProgram[target.program.code] = byProgram[target.program.code] || []).push(values);
  });

  PROGRAMS_.forEach(function (program) {
    var values = byProgram[program.code];
    if (!values) return;
    getSheet_('자료', program).getRange(2, 1, values.length, headers.length).setValues(values);
    Logger.log(program.name + ' › 자료 ' + values.length + '행 옮김');
  });
}

// 「출석부」는 가로 수업 × 세로 성명 행렬이라, 수업 열을 프로그램별로 나눠 각 시트에 새 행렬을 만든다.
// 반환: 출석부를 옮긴 프로그램 목록
function migrateAttendance_(legacySessions, idMap) {
  var values = getSheet_('출석부').getDataRange().getValues();
  if (values.length < 2) return [];

  var header = values[0];
  // 학생ID 열이 생기기 전 양식(1열 성명, 2열부터 수업)도 있어, 2열 머리글이 수업이면 옛 양식으로 본다.
  var hasStudentIdColumn = !resolveSessionId_(header[1], legacySessions);
  var firstSessionCol = hasStudentIdColumn ? 2 : 1;

  var columnsByProgram = {};
  for (var c = firstSessionCol; c < header.length; c++) {
    if (header[c] === '' || header[c] == null) continue;
    var target = idMap[resolveSessionId_(header[c], legacySessions)];
    if (!target) {
      Logger.log('공통 시트 출석부 ' + (c + 1) + '열 "' + header[c] + '": 일정에서 찾지 못해 옮기지 않음');
      continue;
    }
    (columnsByProgram[target.program.code] = columnsByProgram[target.program.code] || [])
      .push({ col: c, newId: target.newId });
  }

  var touched = [];
  PROGRAMS_.forEach(function (program) {
    var columns = columnsByProgram[program.code];
    if (!columns) return;

    var matrix = [['성명', '학생ID'].concat(columns.map(function (x) { return x.newId; }))];
    for (var r = 1; r < values.length; r++) {
      var name = values[r][0];
      if (!name) continue;
      var marks = columns.map(function (x) { return copyableValue_(values[r][x.col]); });
      if (marks.join('') === '') continue; // 이 프로그램 수업에 한 번도 출석하지 않은 학생
      var studentId = hasStudentIdColumn ? copyableValue_(values[r][1]) : '';
      matrix.push([copyableValue_(name), studentId].concat(marks));
    }
    getSheet_('출석부', program).getRange(1, 1, matrix.length, matrix[0].length).setValues(matrix);
    Logger.log(program.name + ' › 출석부 ' + (matrix.length - 1) + '명 · 수업 ' + columns.length + '개 옮김');
    touched.push(program);
  });
  return touched;
}

function findProgramByName_(name) {
  for (var i = 0; i < PROGRAMS_.length; i++) {
    if (PROGRAMS_[i].name === name) return PROGRAMS_[i];
  }
  return null;
}

// 선택 목록에 없는 값은 시트가 쓰기를 거부하므로, 버리지 않고 비고로 옮긴다.
// 옛 시트에서 열이 어긋나 메모가 분야 칸에 들어가 있던 경우가 실제로 있었다.
function fitDropdowns_(tab, values, where) {
  var headers = PROGRAM_TAB_HEADERS_[tab];
  var dropdowns = PROGRAM_TAB_DROPDOWNS_[tab] || {};
  var noteIdx = headers.indexOf('비고');
  Object.keys(dropdowns).forEach(function (h) {
    var idx = headers.indexOf(h);
    var v = values[idx];
    if (v === '' || dropdowns[h].indexOf(v) !== -1) return;
    values[noteIdx] = [values[noteIdx], h + ': ' + v].filter(function (x) { return x !== ''; }).join(' / ');
    values[idx] = '';
    Logger.log(where + ': ' + h + ' 값 "' + v + '"가 선택 목록에 없어 비고로 옮김');
  });
  return values;
}

// 날짜·숫자는 그대로 두고, 문자열만 수식 주입을 막는다(CLAUDE.md 보안 6).
function copyableValue_(value) {
  if (value == null) return '';
  return typeof value === 'string' ? sanitizeForSheet_(value) : value;
}
