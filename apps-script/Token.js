/**
 * 토큰: { code, ver, exp }를 서명해 넣는 자체 완결형(stateless) 토큰.
 * docs/api.md 5절 — 유효시간 2시간, 코드 버전 변경 시 일괄 무효화, 서명 키는 Script Properties에만 둠.
 */

var TOKEN_LIFETIME_MS_ = 2 * 60 * 60 * 1000; // 2시간

function getTokenSecret_() {
  var secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  if (!secret) throw new Error('TOKEN_SECRET이 설정되지 않음 — Setup.js의 setupTokenSecret()을 먼저 실행할 것');
  return secret;
}

function signToken_(payload) {
  var payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var sigBytes = Utilities.computeHmacSha256Signature(payloadB64, getTokenSecret_());
  var sigB64 = Utilities.base64EncodeWebSafe(sigBytes);
  return payloadB64 + '.' + sigB64;
}

// 「접근코드」 탭의 현재 버전 값으로 새 토큰을 만든다 (auth·ping 공용).
function issueToken_(codeRow) {
  var expiresAt = Date.now() + TOKEN_LIFETIME_MS_;
  var token = signToken_({ code: codeRow['코드'], ver: Number(codeRow['버전']), exp: expiresAt });
  return { token: token, expiresAt: expiresAt };
}

// 반환: { valid, error } 또는 { valid: true, payload, row }
function verifyToken_(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) {
    return { valid: false, error: 'TOKEN_INVALID' };
  }
  var parts = token.split('.');
  if (parts.length !== 2) return { valid: false, error: 'TOKEN_INVALID' };

  var payloadB64 = parts[0];
  var sigB64 = parts[1];
  var expectedSigB64 = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payloadB64, getTokenSecret_())
  );
  if (expectedSigB64 !== sigB64) return { valid: false, error: 'TOKEN_INVALID' };

  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString());
  } catch (err) {
    return { valid: false, error: 'TOKEN_INVALID' };
  }

  if (!payload.exp || Date.now() > payload.exp) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  // 코드 버전이 바뀌었으면(운영진이 코드 유출 등으로 올린 경우) 즉시 무효화한다.
  var row = findCodeRow_(payload.code);
  if (!row || Number(row['버전']) !== Number(payload.ver)) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  return { valid: true, payload: payload, row: row };
}
