/**
 * action별 처리. data·photo는 WBS 2.7·2.8에서 채운다.
 */

// docs/api.md 3-1 검증 순서 그대로: 코드 존재 → 상태 → 사용기한 → 기기별 실패 횟수 → 발급·기록
function handleAuth_(req) {
  var code = req.code;
  var deviceId = req.deviceId;
  var name = req.name;

  if (!code || !deviceId) return jsonResponse_(false, 'AUTH_INVALID', null);

  var row = findCodeRow_(code);
  if (!row || row['상태'] !== '사용') {
    recordAuthFailure_(deviceId, codePrefix_(code));
    logAccess_('실패(AUTH_INVALID)', code, name, deviceId, 'auth', '');
    return jsonResponse_(false, 'AUTH_INVALID', null);
  }

  if (!isWithinExpiry_(row['사용기한'])) {
    recordAuthFailure_(deviceId, codePrefix_(code));
    logAccess_('실패(AUTH_EXPIRED)', code, name, deviceId, 'auth', '');
    return jsonResponse_(false, 'AUTH_EXPIRED', null);
  }

  if (isDeviceLocked_(deviceId)) {
    logAccess_('실패(AUTH_LOCKED)', code, name, deviceId, 'auth', '');
    return jsonResponse_(false, 'AUTH_LOCKED', null);
  }

  clearAuthFailures_(deviceId);
  var issued = issueToken_(row);
  logAccess_('성공', code, name, deviceId, 'auth', '');
  return jsonResponse_(true, null, {
    token: issued.token,
    expiresAt: issued.expiresAt,
    firstView: row['첫 화면']
  });
}

// docs/api.md 3-2. 새 토큰을 발급해 만료 시각을 늘린다 (docs/decisions.md 협의: 자체 서명 토큰 방식).
function handlePing_(req) {
  var result = verifyToken_(req.token);
  if (!result.valid) return jsonResponse_(false, result.error, null);

  var issued = issueToken_(result.row);
  return jsonResponse_(true, null, {
    token: issued.token,
    expiresAt: issued.expiresAt
  });
}

// docs/api.md 3-3. 인증 직후 1회 호출용 — 공개 자료를 한 번에 모아 반환한다.
function handleData_(req) {
  var result = verifyToken_(req.token);
  if (!result.valid) return jsonResponse_(false, result.error, null);

  return jsonResponse_(true, null, {
    sessions: getSessions_(),
    materials: getPublicMaterials_(),
    participants: getParticipants_(),
    settings: getSettingsMap_()
  });
}

// docs/api.md 3-4. 사진·작품(이미지)만 대상. 실제 축소는 하지 않고 Drive에 올라간 파일을
// 그대로 전달한다 — "축소본"은 운영진이 대표 사진을 고를 때 이미 작게 준비해 올리는 것을 전제로 한다.
function handlePhoto_(req) {
  var result = verifyToken_(req.token);
  if (!result.valid) return jsonResponse_(false, result.error, null);

  var fileId = req.fileId;
  if (!fileId || !findPublicPhotoMaterial_(fileId)) {
    return jsonResponse_(false, 'NOT_FOUND', null);
  }

  try {
    var blob = DriveApp.getFileById(fileId).getBlob();
    return jsonResponse_(true, null, {
      base64: Utilities.base64Encode(blob.getBytes()),
      mimeType: blob.getContentType()
    });
  } catch (err) {
    return jsonResponse_(false, 'NOT_FOUND', null);
  }
}
