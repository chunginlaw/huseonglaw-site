import { createServer } from 'node:http';
import { SocketAddress } from 'node:net';
import { isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const file = process.env.AD_LOG_DB;
const days = Number(process.env.AD_LOG_DAYS);
const port = Number(process.env.AD_LOG_PORT || 8091);
if (!file || !isAbsolute(file) || !Number.isInteger(days) || days < 1 || days > 14) {
  throw new Error('Set AD_LOG_DB to a private absolute path and AD_LOG_DAYS to an approved period (1–14).');
}

process.umask(0o077);
const database = new DatabaseSync(file);
database.exec(`
  PRAGMA secure_delete = ON;
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY, time INTEGER NOT NULL, ip TEXT NOT NULL,
    ad TEXT NOT NULL, media TEXT NOT NULL, keyword_id TEXT, referrer TEXT NOT NULL,
    page TEXT NOT NULL, repeated INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS visits_time ON visits(time);
  CREATE INDEX IF NOT EXISTS visits_ip_time ON visits(ip, time);
`);
const prune = database.prepare('DELETE FROM visits WHERE time <= ?');
const retention = days * 86400000;
const ageLimit = () => Date.now() - retention;
prune.run(ageLimit());
setInterval(() => {
  try { prune.run(ageLimit()); } catch { console.error('Ad visit purge failed'); }
}, 60000).unref();

const insert = database.prepare(`
  INSERT INTO visits(time, ip, ad, media, keyword_id, referrer, page, repeated)
  SELECT ?, ?, ?, ?, ?, ?, ?, EXISTS(SELECT 1 FROM visits WHERE ip = ? AND time > ?)
`);
const origins = new Set(['https://huseonglaw.kr', 'https://www.huseonglaw.kr']);
const pages = new Set([
  '/', '/index.html', '/civil-litigation.html', '/corporate-bankruptcy.html',
  '/criminal-defense.html', '/debt-collection.html', '/incheon-debt-collection.html',
  '/labor-employment.html'
]);

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Vary', 'Origin');
  const finish = (status) => response.writeHead(status).end();

  if (request.url !== '/visit') return finish(404);
  if (request.method !== 'POST') return finish(405);
  const origin = request.headers.origin;
  if (!origins.has(origin)) return finish(403);
  response.setHeader('Access-Control-Allow-Origin', origin);

  // The local HTTPS reverse proxy must overwrite this header with its peer IP.
  const forwarded = request.headers['x-visit-client-ip'];
  const address = typeof forwarded === 'string'
    ? SocketAddress.parse(forwarded.includes(':') ? `[${forwarded}]:0` : `${forwarded}:0`)?.address
    : null;
  const ip = address?.replace(/^::ffff:(?=\d+\.)/, '');
  if (!ip) return finish(400);

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 1024) return finish(413);
      chunks.push(chunk);
    }
  } catch {
    return finish(400);
  }

  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return finish(400); }

  if (!data || typeof data.ad !== 'string' || typeof data.media !== 'string' ||
      !/^nad-[a-z0-9-]{1,45}$/i.test(data.ad) || !/^\d{1,12}$/.test(data.media) ||
      (data.keywordId !== null && (typeof data.keywordId !== 'string' || !/^nkw-[a-z0-9-]{1,45}$/i.test(data.keywordId))) ||
      !['none', 'naver', 'other'].includes(data.referrer) || !pages.has(data.page)) {
    return finish(400);
  }

  try {
    const now = Date.now();
    insert.run(now, ip, data.ad, data.media, data.keywordId, data.referrer, data.page, ip, now - retention);
    return finish(204);
  } catch {
    console.error('Ad visit write failed');
    return finish(503);
  }
});
server.requestTimeout = 10000;
server.listen(port, '127.0.0.1');
