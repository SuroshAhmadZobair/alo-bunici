// Waitlist store for the Alo Bunici landing page.
//   POST /signup          store one row with a consent record, return a private delete link
//   POST /message         store one "Scrie-ne" message (reply contact + consent record), return a private delete link
//   GET  /delete?t=TOKEN  confirm page (a GET never deletes, so link scanners can't wipe rows)
//   POST /delete          delete the row that belongs to TOKEN
//   cron (daily)          delete signups and messages older than 12 months
// Both POSTs are rate limited per client IP (the IP is used as the limiter key only, never stored).
// Tracked in SuroshAhmadZobair/voice-agent-demo (legal pass for landing + ads).

const MAX = 200;
const RETENTION = '-12 months';
const clip = v => (typeof v === 'string' ? v.trim().slice(0, MAX) : '');
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneOk = p => { const d = p.replace(/[^\d]/g, ''); return d.length >= 9 && d.length <= 15; };
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();

// Every consent text ever shown next to the checkbox, by version. The row stores the version and the
// SHA-256 of the text the page actually sent; consent_match = 1 when that hash equals the text below.
// Never edit an entry: add a new version and bump CONSENT_V in index.html.
const CONSENT = {
  'v1-2026-11-16': 'Sunt de acord să fiu contactat prin telefon sau email despre lansare. Confidențialitate',
  'v2-2026-11-20': 'Sunt de acord să fiu contactat prin telefon, SMS sau email doar ca să aflu când pornește Alo Bunici. Pot retrage acordul oricând. Cum folosim datele',
  // "Scrie-ne" form
  'm1-2026-11-20': 'Sunt de acord să folosiți acest contact doar ca să-mi răspundeți.',
};
const LEGACY_V = 'v1-2026-11-16'; // assumed version when a request sends none (the page before 20 Nov 2026)

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// consent record: version, hash of the text the page sent, and whether it matches our copy of that version.
// A request that sends no text gets hash 'none' and match 0: we never record a text nobody showed us.
async function consentRecord(d, fallbackV) {
  const v = clip(d.consent_v) || fallbackV;
  const sent = typeof d.consent_text === 'string' && d.consent_text.trim() !== '';
  const hash = sent ? await sha256(norm(d.consent_text.slice(0, 1000))) : 'none';
  const match = sent && CONSENT[v] && hash === await sha256(norm(CONSENT[v])) ? 1 : 0;
  return { v, hash, match };
}

// Per-IP rate limit (Workers rate limiting binding). The IP is only the counter key.
async function limited(limiter, req) {
  if (!limiter) return false;
  const key = req.headers.get('CF-Connecting-IP') || 'none';
  try { return !(await limiter.limit({ key })).success; } catch { return false; }
}

function deleteUrl(req, token, kind) {
  const u = new URL('/delete', req.url); u.searchParams.set('t', token); if (kind) u.searchParams.set('k', kind);
  return u.toString();
}

function cors(env, origin) {
  const ok = origin === env.ALLOWED_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': ok ? origin : env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
const json = (body, status, h) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function page(title, body, status = 200) {
  return new Response(`<!doctype html><html lang="ro"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · Alo Bunici</title>
<style>
:root{--paper:#F4ECDD;--card:#FFFAF0;--ink:#2B1D14;--rule:#D9C8AC;--terra:#A9471F}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.6 Georgia,serif}
main{max-width:34em;margin:12vh auto;padding:0 16px}
.card{background:var(--card);border:1px solid var(--rule);border-radius:14px;padding:28px 24px}
h1{font-size:30px;line-height:1.2;margin:0 0 14px;font-weight:600}p{margin:0 0 18px}
button{font:inherit;font-weight:600;color:#fff;background:var(--terra);border:0;border-radius:999px;padding:14px 26px;cursor:pointer}
a{color:var(--terra)}
</style></head><body><main><div class="card">${body}</div></main></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' },
  });
}
const BACK = '<p><a href="https://suroshahmadzobair.github.io/alo-bunici/">Înapoi la Alo Bunici</a></p>';

async function signup(req, env, h) {
  if (await limited(env.RL_SIGNUP, req)) return json({ error: 'slow down' }, 429, h);
  let d;
  try { d = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
  if (d.website) return json({ ok: true }, 200, h); // honeypot

  const name = clip(d.name), phone = clip(d.phone), email = clip(d.email);
  if (name.length < 2) return json({ error: 'name' }, 400, h);
  if (phone && !phoneOk(phone)) return json({ error: 'phone' }, 400, h);
  if (email && !emailRe.test(email)) return json({ error: 'email' }, 400, h);
  if (!phone && !email) return json({ error: 'contact' }, 400, h);
  if (d.consent !== true) return json({ error: 'consent' }, 400, h);

  const c = await consentRecord(d, LEGACY_V);

  const utm = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'ttclid']) if (d[k]) utm[k] = clip(d[k]);

  const token = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO signups (name, phone, email, for_whom, city, lives, price, variant, page, utm, ip_country,
       consent_v, consent_hash, consent_match, privacy_v, del_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(name, phone, email, clip(d.for), clip(d.city), clip(d.lives), clip(d.price), clip(d.variant), clip(d.page),
    JSON.stringify(utm), (req.cf && req.cf.country) || '', c.v, c.hash, c.match, clip(d.privacy_v),
    await sha256(token)).run();

  return json({ ok: true, delete_url: deleteUrl(req, token) }, 200, h);
}

async function message(req, env, h) {
  if (await limited(env.RL_MESSAGE, req)) return json({ error: 'slow down' }, 429, h);
  let d;
  try { d = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
  if (d.website) return json({ ok: true }, 200, h); // honeypot

  const body = typeof d.message === 'string' ? d.message.trim().slice(0, 2000) : '';
  const reply = clip(d.reply);
  if (body.length < 5) return json({ error: 'message' }, 400, h);
  if (!emailRe.test(reply) && !phoneOk(reply)) return json({ error: 'reply' }, 400, h);
  if (d.consent !== true) return json({ error: 'consent' }, 400, h);

  const c = await consentRecord(d, '');
  const token = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO messages (body, reply, page, ip_country, consent_v, consent_hash, consent_match, privacy_v, del_hash)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(body, reply, clip(d.page), (req.cf && req.cf.country) || '', c.v, c.hash, c.match, clip(d.privacy_v),
    await sha256(token)).run();

  return json({ ok: true, delete_url: deleteUrl(req, token, 'm') }, 200, h);
}

async function deleteConfirm(url) {
  const t = url.searchParams.get('t') || '';
  if (!/^[0-9a-f-]{36}$/.test(t)) return page('Link greșit', `<h1>Link greșit</h1><p>Linkul de ștergere nu e complet. Copiază-l din nou sau scrie-ne.</p>${BACK}`, 400);
  const what = url.searchParams.get('k') === 'm'
    ? 'Îți ștergem mesajul și contactul de răspuns.'
    : 'Îți scoatem numele, telefonul, emailul și răspunsurile de pe lista de așteptare. Nu te mai anunțăm la lansare.';
  return page('Șterge datele', `<h1>Ștergi datele tale?</h1>
<p>${what}</p>
<form method="post" action="/delete"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">Da, șterge-le</button></form>`);
}

async function deleteRow(req, env) {
  let t = '';
  const ct = req.headers.get('Content-Type') || '';
  try {
    if (ct.includes('application/json')) t = clip((await req.json()).t);
    else t = clip((await req.formData()).get('t'));
  } catch { /* fall through to the bad-link page */ }
  if (!/^[0-9a-f-]{36}$/.test(t)) return page('Link greșit', `<h1>Link greșit</h1><p>Linkul de ștergere nu e complet.</p>${BACK}`, 400);
  const hash = await sha256(t);
  const [a, b] = await env.DB.batch([
    env.DB.prepare('DELETE FROM signups WHERE del_hash = ?').bind(hash),
    env.DB.prepare('DELETE FROM messages WHERE del_hash = ?').bind(hash),
  ]);
  const ns = (a.meta && a.meta.changes) || 0, nm = (b.meta && b.meta.changes) || 0;
  return ns || nm
    ? page('Date șterse', `<h1>Gata, am șters datele tale.</h1><p>${ns ? 'Nu mai ești pe lista de așteptare.' : 'Mesajul tău nu mai există la noi.'}</p>${BACK}`)
    : page('Nimic de șters', `<h1>Nu mai avem date pentru acest link.</h1><p>Au fost deja șterse.</p>${BACK}`);
}

export default {
  async fetch(req, env) {
    const h = cors(env, req.headers.get('Origin'));
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method === 'POST' && url.pathname === '/signup') return signup(req, env, h);
    if (req.method === 'POST' && url.pathname === '/message') return message(req, env, h);
    if (req.method === 'GET' && url.pathname === '/delete') return deleteConfirm(url);
    if (req.method === 'POST' && url.pathname === '/delete') return deleteRow(req, env);
    return json({ error: 'not found' }, 404, h);
  },

  // Retention: nothing is kept longer than 12 months.
  async scheduled(event, env) {
    const [a, b] = await env.DB.batch([
      env.DB.prepare(`DELETE FROM signups WHERE created_at < datetime('now', ?)`).bind(RETENTION),
      env.DB.prepare(`DELETE FROM messages WHERE created_at < datetime('now', ?)`).bind(RETENTION),
    ]);
    console.log(JSON.stringify({ retention: RETENTION, signups: (a.meta && a.meta.changes) || 0, messages: (b.meta && b.meta.changes) || 0 }));
  },
};
