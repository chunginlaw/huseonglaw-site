import { isIP, SocketAddress } from 'node:net';

const origins = new Set(['https://huseonglaw.kr', 'https://www.huseonglaw.kr']);
const pages = new Set([
  '/', '/index.html', '/civil-litigation.html', '/corporate-bankruptcy.html',
  '/criminal-defense.html', '/debt-collection.html', '/incheon-debt-collection.html',
  '/labor-employment.html'
]);
const validAd = /^nad-[a-z0-9-]{1,45}$/i;
const validMedia = /^\d{1,12}$/;
const validKeyword = /^nkw-[a-z0-9-]{1,45}$/i;
const day = 86400000;

function cutoff(env, now) {
  const days = Number(env.RETENTION_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error('Invalid retention period');
  return now - days * day;
}

export default {
  async fetch(request, env) {
    const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
    const reply = (status) => new Response(null, { status, headers });
    if (env.COLLECTION_ENABLED !== 'true' || new URL(request.url).pathname !== '/visit') return reply(404);
    if (request.method !== 'POST') return reply(405);
    const origin = request.headers.get('Origin');
    if (!origins.has(origin)) return reply(403);
    headers.set('Access-Control-Allow-Origin', origin);

    const rawIP = request.headers.get('CF-Connecting-IP');
    const version = rawIP ? isIP(rawIP) : 0;
    if (!version) return reply(400);
    const ip = SocketAddress.parse(version === 6 ? `[${rawIP}]:0` : `${rawIP}:0`)
      ?.address.replace(/^::ffff:(?=\d+\.)/, '');
    if (!ip) return reply(400);

    let data;
    const reader = request.body?.getReader();
    if (!reader) return reply(400);
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let size = 0;
      let json = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024) {
          await reader.cancel();
          return reply(413);
        }
        json += decoder.decode(value, { stream: true });
      }
      data = JSON.parse(json + decoder.decode());
    } catch {
      return reply(400);
    }
    if (!data || typeof data.ad !== 'string' || !validAd.test(data.ad) ||
        typeof data.media !== 'string' || !validMedia.test(data.media) ||
        (data.keywordId !== null && (typeof data.keywordId !== 'string' || !validKeyword.test(data.keywordId))) ||
        !['none', 'naver', 'other'].includes(data.referrer) || !pages.has(data.page)) return reply(400);

    try {
      const now = Date.now();
      await env.DB.prepare(`
        INSERT INTO ad_visits (time, ip, ad, media, keyword_id, referrer, page, repeated)
        VALUES (?, ?, ?, ?, ?, ?, ?, EXISTS (
          SELECT 1 FROM ad_visits WHERE ip = ? AND time > ?
        ))
      `).bind(now, ip, data.ad, data.media, data.keywordId, data.referrer, data.page, ip, cutoff(env, now)).run();
      return reply(204);
    } catch {
      return reply(503);
    }
  },

  async scheduled(_event, env) {
    await env.DB.prepare('DELETE FROM ad_visits WHERE time <= ?').bind(cutoff(env, Date.now())).run();
  }
};
