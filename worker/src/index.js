// Waitlist endpoint: POST /signup stores one row in D1. Nothing else is exposed.
const MAX = 200;
const clip = v => (typeof v === 'string' ? v.trim().slice(0, MAX) : '');
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneOk = p => { const d = p.replace(/[^\d]/g, ''); return d.length >= 9 && d.length <= 15; };

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

export default {
  async fetch(req, env) {
    const h = cors(env, req.headers.get('Origin'));
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'POST' || url.pathname !== '/signup') return json({ error: 'not found' }, 404, h);

    let d;
    try { d = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
    if (d.website) return json({ ok: true }, 200, h); // honeypot

    const name = clip(d.name), phone = clip(d.phone), email = clip(d.email);
    if (name.length < 2) return json({ error: 'name' }, 400, h);
    if (phone && !phoneOk(phone)) return json({ error: 'phone' }, 400, h);
    if (email && !emailRe.test(email)) return json({ error: 'email' }, 400, h);
    if (!phone && !email) return json({ error: 'contact' }, 400, h);
    if (d.consent !== true) return json({ error: 'consent' }, 400, h);

    const utm = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'ttclid']) if (d[k]) utm[k] = clip(d[k]);

    await env.DB.prepare(
      'INSERT INTO signups (name, phone, email, for_whom, city, lives, price, variant, page, utm, ip_country) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(name, phone, email, clip(d.for), clip(d.city), clip(d.lives), clip(d.price), clip(d.variant), clip(d.page),
      JSON.stringify(utm), (req.cf && req.cf.country) || '').run();

    return json({ ok: true }, 200, h);
  },
};
