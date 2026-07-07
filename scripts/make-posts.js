#!/usr/bin/env node
/**
 * Fábrica de publicaciones para redes sociales.
 * Cada ejecución (cron diario) elige el producto del día (prioriza tendencia,
 * rota para no repetir) y genera en social/out/<fecha>/:
 *   - x.txt, facebook.txt, instagram.txt, tiktok.txt, youtube.txt  (texto listo)
 *   - card-cuadrada.html/.png  (1080×1080 → X, Facebook, Instagram feed)
 *   - card-vertical.html/.png  (1080×1920 → TikTok, Instagram stories, YouTube Shorts)
 * El PNG se rasteriza con Edge/Chrome headless si está disponible; si no, queda el HTML.
 *
 * El enlace del anuncio apunta SIEMPRE a la ficha del producto en la tienda
 * (las plataformas penalizan los enlaces de afiliado en crudo).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
const STATE_FILE = path.join(ROOT, 'social', 'state.json');
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { publicadosRecientes: [] };

const publicables = data.productos.filter(p => p.affiliateUrl || process.env.BUILD_PREVIEW === '1');
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const HASHTAGS = '#carpintería #bricolaje #herramientas #taller #DIY #woodworking';

// Regla 80/20: martes (2) y viernes (5) = post de producto (venta);
// el resto de días = consejo de taller (valor, capta seguidores).
const hoy = new Date();
const DIAS_PRODUCTO = [2, 5];
let modo = DIAS_PRODUCTO.includes(hoy.getUTCDay()) && publicables.length ? 'producto' : 'consejo';
if (process.env.POST_MODO) modo = process.env.POST_MODO; // forzar en pruebas: POST_MODO=consejo|producto

let p = null, tip = null, urlFicha, textos, tituloCard;

if (modo === 'producto') {
  // Producto del día: tendencia primero, y de esos el que lleve más tiempo sin salir
  const recientes = new Set(state.publicadosRecientes.slice(-Math.max(publicables.length - 1, 0)));
  const pool = publicables.filter(x => !recientes.has(x.id));
  p = pool.find(x => x.tendencia) || pool[0] || publicables[0];
  urlFicha = `${cfg.tienda.url}/producto/${p.id}.html`;
  const gancho = p.tendencia
    ? `🔥 En tendencia esta semana: ${p.titulo}`
    : `🪵 Herramienta probada en taller: ${p.titulo}`;
  const proTop = p.pros[0] || '';
  tituloCard = p.titulo;
  textos = {
    x: `${gancho}\n\n${proTop ? '✔ ' + proTop + '\n' : ''}💶 ${p.precio}\n\n👉 Veredicto completo y enlace: ${urlFicha}\n\n${HASHTAGS}`.slice(0, 279),
    facebook: `${gancho}\n\n${p.veredicto}\n\n${p.pros.map(x => '✔ ' + x).join('\n')}\n\n💶 Precio: ${p.precio}\n👉 Ficha completa con pros y contras: ${urlFicha}\n\n${HASHTAGS}`,
    instagram: `${gancho}\n\n${p.veredicto}\n\n💶 ${p.precio}\n🔗 Enlace en la bio y en ${urlFicha}\n\n${HASHTAGS} #aliexpressfinds #herramientasdecalidad`,
    tiktok: `[GUION VÍDEO 20-30s]\n1. Plano de la herramienta: "${gancho}"\n2. En uso: "${proTop}"\n3. El pero, a la cara: "${p.contras[0] || 'sin peros graves'}"\n4. Cierre: "Precio: ${p.precio}. Ficha completa en el enlace del perfil."\n\nCAPTION: ${gancho} 🔗 en bio ${HASHTAGS} #aliexpress`,
    youtube: `[YouTube Short — mismo guion que TikTok]\n\nTÍTULO: ${p.titulo} — ¿merece la pena? (opinión de carpintero)\nDESCRIPCIÓN:\n${p.veredicto}\n\nFicha completa con pros/contras y enlace: ${urlFicha}\n\n${HASHTAGS}`,
  };
} else {
  // Consejo de taller rotando (los menos usados primero)
  const { tips } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tips.json'), 'utf8'));
  if (!tips.length) { console.log('ℹ️ Sin consejos en data/tips.json.'); process.exit(0); }
  const usados = state.tipsRecientes || [];
  tip = tips.find(t => !usados.slice(-(tips.length - 1)).includes(t.id)) || tips[0];
  urlFicha = tip.guia ? `${cfg.tienda.url}/guias/${tip.guia}.html` : cfg.tienda.url;
  const gancho = '🪵 Consejo de taller (16 años de oficio)';
  tituloCard = tip.texto;
  const cierre = tip.guia ? `📖 Guía completa: ${urlFicha}` : `📖 Más consejos y herramientas probadas: ${urlFicha}`;
  textos = {
    x: `${gancho}\n\n${tip.texto}\n\n${HASHTAGS}`.slice(0, 279),
    facebook: `${gancho}\n\n${tip.texto}\n\n${cierre}\n\n${HASHTAGS}`,
    instagram: `${gancho}\n\n${tip.texto}\n\n🔗 Enlace en la bio\n\n${HASHTAGS} #aprendecarpinteria #trucosdetaller`,
    tiktok: `[GUION VÍDEO 15-20s]\n1. A cámara o manos trabajando: "${tip.texto.split('.')[0]}."\n2. Demostración o explicación: "${tip.texto}"\n3. Cierre: "Sígueme para un consejo de taller cada día."\n\nCAPTION: ${gancho} ${HASHTAGS} #trucosdetaller`,
    youtube: `[YouTube Short — mismo guion que TikTok]\n\nTÍTULO: ${tip.texto.split('.')[0]} (consejo de carpintero)\nDESCRIPCIÓN:\n${tip.texto}\n\n${cierre}\n\n${HASHTAGS}`,
  };
}

const cardCSS = (w, h) => `
*{margin:0;padding:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;font-family:'Segoe UI',sans-serif;overflow:hidden;
 background:linear-gradient(160deg,#3d2512 0%,#5a3a1e 55%,#7a5230 100%);color:#f5ead9;
 display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:60px}
.badge{background:linear-gradient(135deg,#d9534f,#e08a2e);padding:14px 40px;border-radius:99px;font-size:34px;font-weight:800;margin-bottom:40px}
img{max-width:70%;max-height:${Math.round(h * 0.35)}px;border-radius:20px;margin-bottom:44px;box-shadow:0 10px 40px rgba(0,0,0,.4)}
h1{font-family:Georgia,serif;font-size:${w > h ? 56 : 60}px;line-height:1.2;margin-bottom:30px}
.precio{font-size:80px;font-weight:900;color:#ffcf8a;margin-bottom:30px}
.pro{font-size:38px;opacity:.95;margin-bottom:14px}
.marca{position:absolute;bottom:44px;left:0;right:0;font-size:32px;opacity:.85;font-style:italic}`;

const cardHTML = (w, h) => modo === 'producto' ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${cardCSS(w, h)}</style></head><body>
${p.tendencia ? '<div class="badge">🔥 EN TENDENCIA</div>' : '<div class="badge">🪵 PROBADA EN TALLER</div>'}
${p.imagen ? `<img src="${esc(p.imagen)}">` : ''}
<h1>${esc(p.titulo)}</h1>
<div class="precio">${esc(p.precio)}</div>
${p.pros.slice(0, 2).map(x => `<div class="pro">✔ ${esc(x)}</div>`).join('')}
<div class="marca">${esc(cfg.tienda.nombre)} — ${esc(cfg.tienda.eslogan)}</div>
</body></html>` : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${cardCSS(w, h)}
h1{font-size:${w > h ? 48 : 52}px;font-style:italic}</style></head><body>
<div class="badge">🪵 CONSEJO DE TALLER</div>
<h1>«${esc(tip.texto)}»</h1>
<div class="pro">16 años de oficio detrás de cada consejo</div>
<div class="marca">${esc(cfg.tienda.nombre)} — ${esc(cfg.tienda.eslogan)}</div>
</body></html>`;

// Prompt de imagen IA (pegar en Bing Image Creator / Gemini / Grok, o vía API si hay clave)
const escena = modo === 'producto'
  ? `${p.titulo} sobre un banco de carpintero con virutas de madera`
  : `manos curtidas de carpintero demostrando: ${tip.texto.split('.')[0].toLowerCase()}`;
const promptImagen = `Fotografía cinematográfica realista en un taller de carpintería tradicional español: ${escena}. Luz cálida de atardecer entrando por una ventana lateral, polvo de madera flotando en el aire, herramientas colgadas desenfocadas al fondo, tonos madera y ámbar, profundidad de campo corta, estilo documental artesano. Sin texto, sin marcas de agua, sin rostros reconocibles.`;

// --- salida
const fecha = new Date().toISOString().slice(0, 10);
const OUT = path.join(ROOT, 'social', 'out', fecha);
fs.mkdirSync(OUT, { recursive: true });
for (const [red, txt] of Object.entries(textos)) fs.writeFileSync(path.join(OUT, `${red}.txt`), txt);
fs.writeFileSync(path.join(OUT, 'prompt-imagen.txt'), promptImagen + '\n\n--- Pegar en: Bing Image Creator (bing.com/create), Gemini (gemini.google.com) o Grok. Guardar la imagen como foto-ia.png en esta carpeta si quieres usarla en vez de la tarjeta.');
fs.writeFileSync(path.join(OUT, 'card-cuadrada.html'), cardHTML(1080, 1080));
fs.writeFileSync(path.join(OUT, 'card-vertical.html'), cardHTML(1080, 1920));

// Rasterizar con Edge/Chrome headless si existe
const navegadores = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const nav = navegadores.find(n => fs.existsSync(n));
let png = false;
if (nav) {
  for (const [file, w, h] of [['card-cuadrada', 1080, 1080], ['card-vertical', 1080, 1920]]) {
    try {
      execFileSync(nav, [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        `--window-size=${w},${h}`, `--screenshot=${path.join(OUT, file + '.png')}`,
        'file:///' + path.join(OUT, file + '.html').replace(/\\/g, '/'),
      ], { timeout: 30000, stdio: 'pipe' });
      png = true;
    } catch (e) { console.error(`⚠️ No se pudo rasterizar ${file}: ${e.message.split('\n')[0]}`); }
  }
}

// estado de rotación + manifiesto para publish.js
if (modo === 'producto') {
  state.publicadosRecientes = [...state.publicadosRecientes, p.id].slice(-50);
} else {
  state.tipsRecientes = [...(state.tipsRecientes || []), tip.id].slice(-50);
}
state.ultimo = { fecha, modo, productoId: p?.id || null, tipId: tip?.id || null, urlFicha, dir: `social/out/${fecha}` };
fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ fecha, modo, id: p?.id || tip?.id, titulo: tituloCard, urlFicha, textos: Object.keys(textos), png }, null, 2));

console.log(`✅ Pack del día (${modo}) generado en social/out/${fecha}/ — "${tituloCard.slice(0, 70)}"${p?.tendencia ? ' (🔥 tendencia)' : ''}`);
console.log(`   Texto para: X, Facebook, Instagram, TikTok, YouTube. Imágenes: ${png ? 'PNG 1080² y 1080×1920 ✔' : 'solo HTML (sin navegador headless)'}`);
