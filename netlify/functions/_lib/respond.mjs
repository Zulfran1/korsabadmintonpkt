/* ═══════════════════════════════════════════════════════════════════════════
   RESPOND — helper JSON response standar
   ═══════════════════════════════════════════════════════════════════════════ */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export const MAX_JSON_BYTES = 64 * 1024;

export function ok(data = {}, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function fail(status, message, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

export const badRequest  = (msg = 'Bad request', extra) => fail(400, msg, extra);
export const unauthorized = (msg = 'Unauthorized') => fail(401, msg);
export const forbidden   = (msg = 'Forbidden') => fail(403, msg);
export const notFound    = (msg = 'Not found') => fail(404, msg);
export const conflict    = (msg = 'Conflict', extra) => fail(409, msg, extra);
export const tooMany     = (msg = 'Too many requests') => fail(429, msg);
export const serverError = (msg = 'Server error') => fail(500, msg);

export async function readJSON(req) {
  try {
    const declaredLength = Number(req.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) return null;
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) return null;
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function getCookie(req, name) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function withCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.path)     parts.push(`Path=${opts.path}`);
  if (opts.maxAge)   parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure)   parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  res.headers.append('Set-Cookie', parts.join('; '));
  return res;
}

export function sseResponse(stream) {
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export function requireMethod(req, ...methods) {
  const m = req.method.toUpperCase();
  if (!methods.map(x => x.toUpperCase()).includes(m)) {
    const response = fail(405, `Method ${m} not allowed`, { allow: methods });
    response.headers.set('Allow', methods.join(', '));
    return response;
  }
  return null;
}
