/**
 * 「로그」 탭 기록. docs/api.md 7절: 모든 로그인·자료 요청을 기록한다.
 * docs/api.md 1절 / decisions.md 6-3: 시트에 쓰는 값은 수식 주입을 막는다
 * (= + - @ 로 시작하면 앞에 ' 를 붙여 시트가 수식으로 해석하지 않게 한다).
 */
function sanitizeForSheet_(value) {
  var str = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(str)) return "'" + str;
  return str;
}

// docs/sheet-schema.md 3-8 열 순서: 일시·결과·코드·이름·기기ID·요청·대상 자료
function logAccess_(result, code, name, deviceId, requestType, targetMaterial) {
  getSheet_('로그').appendRow([
    new Date(),
    sanitizeForSheet_(result),
    sanitizeForSheet_(code),
    sanitizeForSheet_(name),
    sanitizeForSheet_(deviceId),
    sanitizeForSheet_(requestType),
    sanitizeForSheet_(targetMaterial)
  ]);
}
