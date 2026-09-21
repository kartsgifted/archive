/**
 * 시트 읽기 결과를 CacheService에 저장한다 (docs/decisions.md 9절 "응답 속도").
 * 시트를 여는 데만 1초 안팎이 걸려, 자료가 바뀌지 않았는데 매 요청마다 시트 4개를 여는 것을 막는다.
 *
 * 무효화는 키를 지우는 대신 **버전 번호를 올린다.** 지울 키 목록을 관리하지 않아도 되고,
 * 여러 요청이 동시에 들어와도 어긋나지 않는다. 옛 키는 유효시간이 지나면 저절로 사라진다.
 */

var CACHE_TTL_SECONDS_ = 21600; // 6시간 (CacheService 최대치). 편집 트리거가 버전을 올리므로 길게 둔다
var CACHE_CHUNK_CHARS_ = 30000; // 키 하나에 100KB 제한. 한글은 글자당 3바이트라 넉넉히 잡는다
var CACHE_MAX_CHUNKS_ = 60;

function cacheVersion_() {
  return PropertiesService.getScriptProperties().getProperty('CACHE_VERSION') || '0';
}

// 시트가 편집되면 호출한다. 다음 요청부터 시트를 다시 읽는다.
function bumpCacheVersion_() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('CACHE_VERSION', String(Number(cacheVersion_()) + 1));
}

function cacheKey_(name) {
  return 'v' + cacheVersion_() + '_' + name;
}

function cacheReadJson_(name) {
  var cache = CacheService.getScriptCache();
  var key = cacheKey_(name);
  var chunkCount = Number(cache.get(key));
  if (!chunkCount) return null;

  var keys = [];
  for (var i = 0; i < chunkCount; i++) keys.push(key + '_' + i);
  var parts = cache.getAll(keys);

  var text = '';
  for (var j = 0; j < chunkCount; j++) {
    var part = parts[key + '_' + j];
    if (part == null) return null; // 일부만 남아 있으면 캐시를 쓰지 않는다
    text += part;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

function cacheWriteJson_(name, value) {
  var text = JSON.stringify(value);
  var key = cacheKey_(name);
  var chunks = {};
  var chunkCount = 0;
  for (var pos = 0; pos < text.length; pos += CACHE_CHUNK_CHARS_) {
    chunks[key + '_' + chunkCount] = text.substring(pos, pos + CACHE_CHUNK_CHARS_);
    chunkCount++;
  }
  if (chunkCount > CACHE_MAX_CHUNKS_) return; // 캐시하기엔 너무 큼 — 매번 시트를 읽는다

  var cache = CacheService.getScriptCache();
  cache.putAll(chunks, CACHE_TTL_SECONDS_);
  cache.put(key, String(chunkCount), CACHE_TTL_SECONDS_);
}

// 캐시에 있으면 그대로, 없으면 build()로 만들어 저장한 뒤 돌려준다.
function cached_(name, build) {
  var hit = cacheReadJson_(name);
  if (hit !== null) return hit;
  var value = build();
  cacheWriteJson_(name, value);
  return value;
}
