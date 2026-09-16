/**
 * 「설정」 탭(항목-값 구조)에서 운영 값을 읽는다. 값이 없으면 fallback을 쓴다 —
 * 담당자가 시트에 행을 안 넣어도 기본값으로 동작하고, 넣으면 코드 수정 없이 바뀐다.
 */
function getSetting_(key, fallback) {
  var rows = sheetRowsAsObjects_('설정');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i]['항목'] === key && rows[i]['값'] !== '' && rows[i]['값'] != null) {
      return rows[i]['값'];
    }
  }
  return fallback;
}
