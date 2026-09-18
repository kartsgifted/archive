/**
 * docs/api.md 6절 실패 제한. 임계치는 시트 「설정」 탭에서 조정 가능하고,
 * 값이 없으면 기본값을 쓴다. 코드별 누적 제한·급증 기준의 정확한 값은
 * **확인 필요** — 지금은 기본값으로 동작만 만들어 둔 상태다.
 */

var DEVICE_FAIL_LIMIT_DEFAULT_ = 5;        // docs/api.md 6절: 기기별 5회
var DEVICE_LOCK_MINUTES_DEFAULT_ = 10;     // docs/api.md 6절: 10분 잠금
var CODE_SURGE_LIMIT_DEFAULT_ = 20;        // 확인 필요: "급증" 기준 미정, 임시값
var CODE_SURGE_WINDOW_MINUTES_DEFAULT_ = 5; // 확인 필요: 판단 시간 미정, 임시값

function isDeviceLocked_(deviceId) {
  var raw = CacheService.getScriptCache().get('authfail_device_' + deviceId);
  var count = raw ? Number(raw) : 0;
  var limit = Number(getSetting_('기기별 실패 잠금 기준', DEVICE_FAIL_LIMIT_DEFAULT_));
  return count >= limit;
}

function clearAuthFailures_(deviceId) {
  CacheService.getScriptCache().remove('authfail_device_' + deviceId);
}

// 기기별 실패 횟수를 늘리고(잠금 판정용), 코드 앞부분(배포 단위) 실패도 함께 누적해 급증 알림을 확인한다.
function recordAuthFailure_(deviceId, codePrefix) {
  var cache = CacheService.getScriptCache();
  var lockMinutes = Number(getSetting_('기기별 잠금 시간(분)', DEVICE_LOCK_MINUTES_DEFAULT_));

  var deviceKey = 'authfail_device_' + deviceId;
  var deviceCount = (Number(cache.get(deviceKey)) || 0) + 1;
  cache.put(deviceKey, String(deviceCount), lockMinutes * 60);

  var surgeWindowMinutes = Number(getSetting_('코드별 실패 급증 판단 시간(분)', CODE_SURGE_WINDOW_MINUTES_DEFAULT_));
  var codeKey = 'authfail_code_' + codePrefix;
  var codeCount = (Number(cache.get(codeKey)) || 0) + 1;
  cache.put(codeKey, String(codeCount), surgeWindowMinutes * 60);
  maybeNotifySurge_(codePrefix, codeCount, surgeWindowMinutes);
}

// "KA-MUSIC-7Q4F" → "KA-MUSIC" (docs/sheet-schema.md 8절: 앞부분이 배포 단위)
function codePrefix_(code) {
  var idx = String(code).lastIndexOf('-');
  return idx === -1 ? String(code) : String(code).substring(0, idx);
}

// 임계치를 처음 넘는 순간 한 번만 메일을 보낸다. 주소가 비어있으면(확인 필요) 아무 것도 하지 않는다.
function maybeNotifySurge_(codePrefix, codeFailCount, surgeWindowMinutes) {
  var limit = Number(getSetting_('코드별 실패 급증 기준', CODE_SURGE_LIMIT_DEFAULT_));
  if (codeFailCount !== limit) return;

  var email = getSetting_('운영진 알림 메일', '');
  if (!email) return;

  MailApp.sendEmail(
    email,
    '[K예술영재 아카이빙] 로그인 실패 급증',
    codePrefix + ' 코드에서 최근 ' + surgeWindowMinutes + '분간 실패 ' + codeFailCount + '회가 발생했습니다.'
  );
}
