/** Opens an SSE response and returns an `emit(event, data)` writer. */
export function sseStart(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  return (event, data = {}) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
