import { API_BASE_URL, OWNER_KEY_STORAGE } from '../constants';

export function ownerKey() {
  let key = localStorage.getItem(OWNER_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(OWNER_KEY_STORAGE, key);
  }
  return key;
}

const tryJson = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-owner-key': ownerKey() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const parsed = tryJson(text);
  if (!res.ok) {
    // status and body ride along so callers can handle 409 (version conflict).
    throw Object.assign(new Error(parsed?.error || text || res.statusText), { status: res.status, body: parsed });
  }
  return parsed;
}
