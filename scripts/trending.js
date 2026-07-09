#!/usr/bin/env node
/**
 * Buscador automático de herramientas en tendencia (AliExpress Affiliate API).
 * Usa el método oficial aliexpress.affiliate.hotproduct.query del programa Portals.
 *
 * Requiere en el entorno (o en config/settings.json):
 *   ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET  ← se obtienen gratis en openservice.aliexpress.com
 *   y el trackingId de Portals en config/settings.json
 *
 * Qué hace en cada ejecución (cron diario):
 *   1. Consulta productos calientes por cada palabra clave del nicho.
 *   2. Filtra: rating alto, ventas mínimas, precio razonable.
 *   3. Añade los mejores a data/products.json con tendencia:true y el enlace
 *      de afiliado YA generado por la API (promotion_link) → se publican solos.
 *   4. Los que ya existían pierden la marca de tendencia a los 14 días.
 *
 * Sin credenciales: no rompe nada, avisa y sale (la tienda sigue funcionando).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.json'), 'utf8'));
const FILE = path.join(ROOT, 'data', 'products.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const APP_KEY = process.env.ALIEXPRESS_APP_KEY || (cfg.afiliado.appKey.startsWith('RELLENAR') ? '' : cfg.afiliado.appKey);
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET || '';
const TRACKING = cfg.afiliado.trackingId.startsWith('RELLENAR') ? '' : cfg.afiliado.trackingId;

// Palabras clave del nicho con su categoría de la tienda: se rotan, edítalas a gusto
const KEYWORDS = [
  { kw: 'woodworking tools', cat: 'electricas' },
  { kw: 'japanese saw', cat: 'corte' },
  { kw: 'carpenter square', cat: 'medicion' },
  { kw: 'wood chisel set', cat: 'corte' },
  { kw: 'router bit', cat: 'electricas' },
  { kw: 'clamp woodworking', cat: 'sujecion' },
  { kw: 'dowel jig', cat: 'sujecion' },
  { kw: 'pocket hole jig', cat: 'sujecion' },
  { kw: 'sharpening stone', cat: 'corte' },
  { kw: 'marking gauge', cat: 'medicion' },
  { kw: 'digital caliper', cat: 'medicion' },
  { kw: 'workbench vise', cat: 'sujecion' },
];
const MAX_NUEVOS_POR_RUN = 3;    // no inflar el catálogo con morralla
const MIN_RATING = 4.6;          // evaluación mínima
const MIN_VENTAS = 300;          // ventas mínimas (producto probado)
const DIAS_TENDENCIA = 14;

if (!APP_KEY || !APP_SECRET || !TRACKING) {
  console.log('ℹ️ Sin credenciales de la API de AliExpress (ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET / trackingId).');
  console.log('   La búsqueda de tendencias se activará sola cuando existan. Guía: README.md sección "API".');
  caducarTendencias();
  process.exit(0);
}

// --- Firma TOP (protocolo open-platform AliExpress): md5(secret + k1v1k2v2... + secret) en MAYÚSCULAS
function firmar(params) {
  const base = Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHash('md5').update(APP_SECRET + base + APP_SECRET, 'utf8').digest('hex').toUpperCase();
}

// La pasarela TOP exige el timestamp en hora de China (GMT+8), no en UTC
function timestampChina() {
  return new Date(Date.now() + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
}

function llamarAPI(metodo, extra) {
  const params = {
    method: metodo,
    app_key: APP_KEY,
    sign_method: 'md5',
    timestamp: timestampChina(),
    format: 'json',
    v: '2.0',
    ...extra,
  };
  params.sign = firmar(params);
  const body = new URLSearchParams(params).toString();
  return new Promise((resolve, reject) => {
    const req = https.request('https://api-sg.aliexpress.com/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('Respuesta no JSON: ' + buf.slice(0, 200))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout API')));
    req.end(body);
  });
}

function caducarTendencias() {
  let cambios = 0;
  const ahora = Date.now();
  for (const p of data.productos) {
    if (p.tendencia && p.tendenciaDesde && ahora - new Date(p.tendenciaDesde).getTime() > DIAS_TENDENCIA * 864e5) {
      p.tendencia = false;
      cambios++;
    }
  }
  if (cambios) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    console.log(`🕐 ${cambios} producto(s) han salido de tendencia (>${DIAS_TENDENCIA} días).`);
  }
}

function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

const MODO_TEST = process.argv.includes('--test');

(async () => {
  if (MODO_TEST) {
    // Prueba de credenciales: una sola llamada, no escribe nada
    console.log('🧪 Modo test: comprobando credenciales contra la API…');
    const r = await llamarAPI('aliexpress.affiliate.hotproduct.query', {
      keywords: 'woodworking tools',
      target_currency: 'EUR',
      target_language: 'ES',
      tracking_id: TRACKING,
      page_size: '5',
      ship_to_country: 'ES',
    });
    if (r.error_response) {
      console.error('❌ La API devuelve error:', JSON.stringify(r.error_response, null, 2));
      process.exit(1);
    }
    const lista = r?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result?.products?.product || [];
    console.log(`✅ Credenciales OK — la API devuelve ${lista.length} producto(s).`);
    lista.slice(0, 3).forEach(p => console.log(`   · ${p.product_title} — ${p.target_sale_price || p.sale_price} | enlace afiliado: ${p.promotion_link ? 'SÍ' : 'NO'}`));
    process.exit(0);
  }

  caducarTendencias();
  // rota keywords según el día del año para variar la búsqueda diaria
  const dia = Math.floor(Date.now() / 864e5);
  const kws = [KEYWORDS[dia % KEYWORDS.length], KEYWORDS[(dia + 5) % KEYWORDS.length]];
  const candidatos = [];

  for (const { kw, cat } of kws) {
    console.log(`🔎 Buscando tendencias: "${kw}"…`);
    try {
      const r = await llamarAPI('aliexpress.affiliate.hotproduct.query', {
        keywords: kw,
        target_currency: 'EUR',
        target_language: 'ES',
        tracking_id: TRACKING,
        page_size: '20',
        sort: 'LAST_VOLUME_DESC',
        ship_to_country: 'ES',
      });
      const lista = r?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result?.products?.product || [];
      for (const it of lista) {
        const rating = parseFloat(it.evaluate_rate) || 0;   // viene como "96.5%"
        const ventas = parseInt(it.lastest_volume) || 0;
        if (rating < MIN_RATING * 20 || ventas < MIN_VENTAS) continue; // 4.6/5 ≈ 92%
        candidatos.push({
          id: slug(it.product_title),
          categoria: cat,
          titulo: it.product_title,
          precio: `${it.target_sale_price || it.sale_price} €`,
          precioAntes: (it.target_original_price || it.original_price) && (it.target_original_price || it.original_price) !== (it.target_sale_price || it.sale_price) ? `${it.target_original_price || it.original_price} €` : '',
          valoracion: Math.round(rating / 20 * 10) / 10,
          ventas: ventas,
          imagen: it.product_main_image_url || '',
          urlProducto: it.product_detail_url,
          affiliateUrl: it.promotion_link || '',
          veredicto: `Producto en tendencia esta semana en AliExpress (${ventas} ventas recientes, valoración ${(rating / 20).toFixed(1)}/5). Añadido automáticamente por el radar de novedades — veredicto de taller pendiente de revisión.`,
          pros: [`${ventas} ventas recientes`, `Valoración ${(rating / 20).toFixed(1)}/5`],
          contras: ['Añadido por el radar automático: revisar calidad antes de recomendarlo en guías'],
          tendencia: true,
          tendenciaDesde: new Date().toISOString(),
          origen: 'radar-auto',
        });
      }
    } catch (e) {
      console.error(`⚠️ Error consultando "${kw}": ${e.message}`);
    }
  }

  // dedupe contra catálogo y entre sí, mejores primero (más ventas)
  const existentes = new Set(data.productos.map(p => p.id));
  const nuevos = [];
  for (const c of candidatos.sort((a, b) => parseInt(b.pros[0]) - parseInt(a.pros[0]))) {
    if (existentes.has(c.id) || nuevos.some(n => n.id === c.id)) continue;
    if (!c.affiliateUrl) continue; // sin enlace de afiliado no interesa
    nuevos.push(c);
    if (nuevos.length >= MAX_NUEVOS_POR_RUN) break;
  }

  data.productos.push(...nuevos);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  console.log(`✅ Radar de tendencias: ${nuevos.length} producto(s) nuevo(s) añadido(s) de ${candidatos.length} candidatos.`);
  nuevos.forEach(n => console.log(`   🔥 ${n.titulo} — ${n.precio}`));
})();
