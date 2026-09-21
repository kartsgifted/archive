/**
 * 「로그」 탭 기록. docs/api.md 7절: 모든 로그인·자료 요청을 기록한다.
 * docs/api.md 1절 / decisions.md 6-3: 시트에 쓰는 값은 수식 주입을 막는다
 * (= + - @ 로 시작하면 앞에 ' 를 붙여 시트가 수식으로 해석하지 않게 한다).
 *
 * 시트 쓰기는 요청 시간에 그대로 더해지므로(docs/decisions.md 9절 "응답 속도"),
 * **성공 기록은 캐시에 모았다가 1분마다 한꺼번에 쓴다.** 실패 기록은 침입 시도를 보는 근거라
 * 미루지 않고 그 자리에서 쓴다.
 */
var LOG_BUFFER_KEY_ = 'logbuf';
var LOG_BUFFER_FLUSH_SIZE_ = 20;
var LOG_BUFFER_TTL_SECONDS_ = 600;

function sanitizeForSheet_(value) {
  var str = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(str)) return "'" + str;
  return str;
}

// docs/sheet-schema.md 3-8 열 순서: 일시·결과·코드·이름·기기ID·요청·대상 자료
function logAccess_(result, code, name, deviceId, requestType, targetMaterial) {
  var row = [
    new Date(),
    sanitizeForSheet_(result),
    sanitizeForSheet_(code),
    sanitizeForSheet_(name),
    sanitizeForSheet_(deviceId),
    sanitizeForSheet_(requestType),
    sanitizeForSheet_(targetMaterial)
  ];

  if (String(result).indexOf('실패') === 0) {
    appendLogRows_([row]);
    return;
  }
  bufferLogRow_(row);
}

// 여러 요청이 동시에 버퍼를 고치면 기록이 사라질 수 있어 잠금을 쓴다.
// 잠금을 못 잡으면 미루지 않고 바로 쓴다(느려도 기록을 잃지 않는 쪽).
function bufferLogRow_(row) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) {
    appendLogRows_([row]);
    return;
  }
  try {
    var cache = CacheService.getScriptCache();
    var buffered = cache.get(LOG_BUFFER_KEY_);
    var rows = buffered ? JSON.parse(buffered) : [];
    rows.push([row[0].toISOString()].concat(row.slice(1))); // JSON에 담으려면 일시를 문자열로 바꿔야 한다
    if (rows.length >= LOG_BUFFER_FLUSH_SIZE_) {
      cache.remove(LOG_BUFFER_KEY_);
      appendLogRows_(bufferedRowsToSheetRows_(rows));
    } else {
      cache.put(LOG_BUFFER_KEY_, JSON.stringify(rows), LOG_BUFFER_TTL_SECONDS_);
    }
  } finally {
    lock.releaseLock();
  }
}

// 1분마다 도는 트리거(Triggers.js)와 [로그 기록하기] 메뉴가 부른다.
function flushLogBuffer_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  var rows;
  try {
    var cache = CacheService.getScriptCache();
    var buffered = cache.get(LOG_BUFFER_KEY_);
    if (!buffered) return;
    rows = JSON.parse(buffered);
    cache.remove(LOG_BUFFER_KEY_);
  } finally {
    lock.releaseLock();
  }
  if (!rows || rows.length === 0) return;
  appendLogRows_(bufferedRowsToSheetRows_(rows));
}

function bufferedRowsToSheetRows_(rows) {
  return rows.map(function (row) { return [new Date(row[0])].concat(row.slice(1)); });
}

function appendLogRows_(rows) {
  var sheet = getSheet_('로그');
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}
