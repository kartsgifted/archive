/**
 * docs/api.md 3-3 data 응답 조립. 시트 헤더(한글) → 화면이 쓰는 영어 camelCase 필드로 옮긴다.
 * 세 프로그램 시트를 읽어 한 배열로 합치므로 응답 모양은 시트를 나누기 전과 같다.
 */

// 세 프로그램 시트의 같은 탭을 읽어, 행마다 mapRow(row, program) 결과를 모은다.
function collectFromPrograms_(sheetName, mapRow) {
  var out = [];
  PROGRAMS_.forEach(function (program) {
    sheetRowsAsObjects_(sheetName, program).forEach(function (row) {
      var mapped = mapRow(row, program);
      if (mapped) out.push(mapped);
    });
  });
  return out;
}

function getSessions_() {
  return collectFromPrograms_('일정', function (row, program) {
    return {
      sessionId: row['세션ID'],
      program: program.name, // 시트 열이 아니라 읽은 시트로 정한다 (docs/sheet-schema.md 3-2)
      discipline: row['분야'],
      date: formatDateCell_(row['일자']),
      startTime: formatTimeCell_(row['시작시각']),
      endTime: formatTimeCell_(row['종료시각']),
      region: row['권역'],
      round: row['회차'],
      className: row['수업명'],
      instructor: row['강사명'],
      note: row['비고'] // 장소 등 정식 열이 없는 값을 임시로 담아 둔 자리 (확인 필요, docs/sheet-schema.md 3-2)
    };
  });
}

// 공개여부 = 공개인 것만 내보낸다 (docs/decisions.md 6절: 요청마다 검증).
function getPublicMaterials_() {
  return collectFromPrograms_('자료', function (row) {
    if (row['공개여부'] !== '공개') return null;
    return {
      sessionId: row['세션ID'],
      type: row['자료유형'],
      fileName: row['파일명'],
      link: row['링크'],
      spec: row['규격'],
      studentName: row['학생명'],
      studentId: row['학생ID'],
      discipline: row['분야']
    };
  });
}

function getParticipants_() {
  return collectFromPrograms_('참여자', function (row) {
    return {
      name: row['성명'],
      studentId: row['학생ID'],
      sessionId: row['세션ID']
    };
  });
}

// photo 요청 전용: 링크(Drive 파일ID)로 「자료」 행을 찾되, 사진 계열(사진·작품(이미지))이고
// 공개여부 = 공개인 것만 인정한다. docs/decisions.md 6절: 요청 시점에도 공개여부를 다시 확인한다.
// 학생 작품은 세션ID가 없어 소속 시트를 알 수 없으므로 세 시트를 모두 찾는다.
function findPublicPhotoMaterial_(fileId) {
  var photoTypes = { '사진': true, '작품(이미지)': true };
  for (var p = 0; p < PROGRAMS_.length; p++) {
    var rows = sheetRowsAsObjects_('자료', PROGRAMS_[p]);
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row['링크'] === fileId && photoTypes[row['자료유형']] && row['공개여부'] === '공개') {
        return row;
      }
    }
  }
  return null;
}

// { 항목: 값 } 형태로 돌려준다.
function getSettingsMap_() {
  var map = {};
  sheetRowsAsObjects_('설정').forEach(function (row) {
    if (row['항목']) map[row['항목']] = row['값'];
  });
  return map;
}
