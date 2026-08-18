import { API_BASE_URL } from '../constants';
import { ownerKey } from './api';

/**
 * POSTs a body and streams back SSE events. EventSource can't POST, so we
 * read the response body ourselves.
 */
export async function postSSE(path, body, onEvent) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-owner-key': ownerKey(),
      accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(tryJson(text)?.error || text || res.statusText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const event = frame.match(/^event: (.*)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      if (event) onEvent(event, data ? JSON.parse(data) : {});
    }
  }
}

const tryJson = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
