#!/usr/bin/env node
/**
 * Publicador automático del pack del día (generado por make-posts.js).
 *
 * Redes con publicación 100% automática (si hay credenciales en el entorno):
 *   X          → X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 *   Facebook   → FB_PAGE_ID, FB_PAGE_TOKEN            (página, no perfil)
 *   Instagram  → IG_USER_ID, FB_PAGE_TOKEN + SOCIAL_IMAGE_BASE (URL pública base
 *                donde queda el PNG, p.ej. https://raw.githubusercontent.com/USER/tienda-taller/main)
 *
 * TikTok y YouTube requieren vídeo + aprobación de API: el pack queda listo en
 * social/out/<fecha>/ para subirlo a mano (fase 2: API oficial cuando aprueben la app).
 *
 * Sin credenciales de una red: la salta con aviso, nunca rompe.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'social', 'state.json'), 'utf8'));
const OUT = path.join(ROOT, state.ultimo.dir);
const leer = red => fs.readFileSync(path.join(OUT, `${red}.txt`), 'utf8');

function pedir(url, { method = 'POST', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers, timeout: 20000 }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end(body);
  });
}

// ---------- X (OAuth 1.0a firmado a mano, cero dependencias) ----------
async function publicarX() {
  const { X_API_KEY: ck, X_API_SECRET: cs, X_ACCESS_TOKEN: at, X_ACCESS_SECRET: as } = process.env;
  if (!ck || !cs || !at || !as) return console.log('⏭️ X: sin credenciales (X_API_KEY…). Saltada.');
  const url = 'https://api.x.com/2/tweets';
  const oauth = {
    oauth_consumer_key: ck,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: at,
    oauth_version: '1.0',
  };
  const enc = encodeURIComponent;
  const paramStr = Object.keys(oauth).sort().map(k => `${enc(k)}=${enc(oauth[k])}`).join('&');
  const base = `POST&${enc(url)}&${enc(paramStr)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', `${enc(cs)}&${enc(as)}`).update(base).digest('base64');
  const authHeader = 'OAuth ' + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
  const r = await pedir(url, {
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: leer('x') }),
  });
  console.log(r.status === 201 ? '✅ X: publicado.' : `❌ X: ${r.status} ${r.body.slice(0, 300)}`);
}

// ---------- Facebook (página) ----------
async function publicarFacebook() {
  const { FB_PAGE_ID: id, FB_PAGE_TOKEN: token } = process.env;
  if (!id || !token) return console.log('⏭️ Facebook: sin credenciales (FB_PAGE_ID/FB_PAGE_TOKEN). Saltada.');
  const body = new URLSearchParams({ message: leer('facebook'), link: state.ultimo.urlFicha, access_token: token }).toString();
  const r = await pedir(`https://graph.facebook.com/v21.0/${id}/feed`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  console.log(r.status === 200 ? '✅ Facebook: publicado.' : `❌ Facebook: ${r.status} ${r.body.slice(0, 300)}`);
}

// ---------- Instagram (necesita imagen en URL pública) ----------
async function publicarInstagram() {
  const { IG_USER_ID: id, FB_PAGE_TOKEN: token, SOCIAL_IMAGE_BASE: base } = process.env;
  if (!id || !token) return console.log('⏭️ Instagram: sin credenciales (IG_USER_ID/FB_PAGE_TOKEN). Saltada.');
  if (!fs.existsSync(path.join(OUT, 'card-cuadrada.png'))) return console.log('⏭️ Instagram: no hay PNG del día (falta navegador headless).');
  if (!base) return console.log('⏭️ Instagram: falta SOCIAL_IMAGE_BASE (URL pública base del repo para servir el PNG).');
  const imageUrl = `${base.replace(/\/$/, '')}/${state.ultimo.dir}/card-cuadrada.png`;
  const crear = await pedir(`https://graph.facebook.com/v21.0/${id}/media`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ image_url: imageUrl, caption: leer('instagram'), access_token: token }).toString(),
  });
  const creationId = JSON.parse(crear.body || '{}').id;
  if (!creationId) return console.log(`❌ Instagram (contenedor): ${crear.status} ${crear.body.slice(0, 300)}`);
  const pub = await pedir(`https://graph.facebook.com/v21.0/${id}/media_publish`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: creationId, access_token: token }).toString(),
  });
  console.log(pub.status === 200 ? '✅ Instagram: publicado.' : `❌ Instagram: ${pub.status} ${pub.body.slice(0, 300)}`);
}

(async () => {
  console.log(`📣 Publicando pack del ${state.ultimo.fecha} — producto ${state.ultimo.productoId}`);
  await publicarX().catch(e => console.error('❌ X:', e.message));
  await publicarFacebook().catch(e => console.error('❌ Facebook:', e.message));
  await publicarInstagram().catch(e => console.error('❌ Instagram:', e.message));
  console.log('📦 TikTok y YouTube: pack listo en ' + state.ultimo.dir + ' (guion + caption + tarjeta vertical). Subida manual hasta aprobar sus APIs.');
})();
