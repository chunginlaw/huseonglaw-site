// Test fixtures use reserved documentation IPs. Request IP headers are never read.
const samples = new Map([
  ['/test/first', '192.0.2.10'],
  ['/test/second', '198.51.100.20']
]);
const sevenDays = 7 * 24 * 60 * 60 * 1000;
const headers = { 'Cache-Control': 'no-store' };

export default {
  async fetch(request, env) {
    if (!env.TEST_TOKEN || request.headers.get('authorization') !== 'Bearer ' + env.TEST_TOKEN) {
      return new Response(null, { status: 404, headers });
    }
    const path = new URL(request.url).pathname;
    const ip = samples.get(path);
    const write = request.method === 'POST' && ip;
    const read = request.method === 'GET' && path === '/test/visits';
    if (!write && !read) return new Response(null, { status: 404, headers });

    const now = Date.now();
    const cutoff = now - sevenDays;
    const prune = env.DB.prepare('DELETE FROM visits WHERE time <= ?').bind(cutoff);
    if (write) {
      const insert = env.DB.prepare(`
        INSERT INTO visits (time, ip, source, repeated)
        VALUES (?, ?, 'naver-test', EXISTS (
          SELECT 1 FROM visits WHERE ip = ? AND time > ?
        ))
      `).bind(now, ip, ip, cutoff);
      await env.DB.batch([prune, insert]);
      return new Response(null, { status: 204, headers });
    }

    const rows = env.DB.prepare(`
      SELECT time, ip, source, repeated FROM visits
      WHERE time > ? ORDER BY id DESC LIMIT 50
    `).bind(cutoff);
    const [, result] = await env.DB.batch([prune, rows]);
    return Response.json(result.results.map(row => ({
      ...row,
      time: new Date(row.time).toISOString(),
      repeated: Boolean(row.repeated)
    })), { headers });
  }
};
