/**
 * 관문(Apps Script 웹앱) 호출 공통 모듈. docs/api.md 참조.
 * 토큰은 sessionStorage, 기기ID는 localStorage(인증 수단 아님, 실패 제한·로그 구분용).
 * 관문 주소는 화면 코드와 함께 공개된다고 가정한다(docs/decisions.md 6-3절) — 실제 보호는
 * 관문이 매 요청마다 토큰·공개여부를 검증하는 데서 나온다.
 */
const GATEWAY_URL = 'https://script.google.com/macros/s/AKfycbw1lMcmd21VQGWjtStaTKxH05Qsg5lkOZUDZV_NyyhA-OBM_cbdULZQTdUqq8HrLsMH/exec';

const TOKEN_KEY = 'karts_token';
const TOKEN_EXPIRES_KEY = 'karts_token_expires_at';
const DEVICE_ID_KEY = 'karts_device_id';

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
function getTokenExpiresAt() { return Number(sessionStorage.getItem(TOKEN_EXPIRES_KEY) || 0); }
function setToken(token, expiresAt) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TOKEN_EXPIRES_KEY, String(expiresAt));
}
function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRES_KEY);
}

class GatewayError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const GATEWAY_TIMEOUT_MS = 15000;

async function callGateway(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    throw new GatewayError(e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new GatewayError('SERVER_ERROR');
  }
  if (!json.ok) throw new GatewayError(json.error || 'SERVER_ERROR');
  return json.data;
}

const api = {
  async auth(code, name) {
    return callGateway({ action: 'auth', code, name, deviceId: getDeviceId() });
  },
  async ping(token) {
    return callGateway({ action: 'ping', token });
  },
  async data(token) {
    return callGateway({ action: 'data', token });
  },
  async photo(token, fileId) {
    return callGateway({ action: 'photo', token, fileId });
  }
};
