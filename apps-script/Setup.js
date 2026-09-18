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
