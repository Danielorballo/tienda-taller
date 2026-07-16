#!/usr/bin/env node
/**
 * make-video.js — MOTOR DE VÍDEO PUBLICITARIO
 *
 * Genera un vídeo vertical 1080×1920 (Reels / TikTok / Shorts) para un producto:
 *   escena 1: gancho (foto IA del taller + titular)
 *   escena 2: el producto (foto real de AliExpress si la hay, si no foto IA)
 *   escena 3: veredicto del carpintero (el pro + el contra, sin vender humo)
 *   escena 4: cierre + llamada a la acción (enlace en la bio)
 *
 * Todo con Node + ffmpeg. Sin servicios de pago, sin claves.
 * Las tarjetas se rasterizan con Edge/Chrome headless (igual que make-posts.js).
 *
 * Uso:
 *   node scripts/make-video.js                 → producto rotativo del día
 *   node scripts/make-video.js <id-producto>   → producto concreto
 *   node scripts/make-video.js --todos         → uno por cada producto publicable
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'social', 'video');
const W = 1080, H = 1920, FPS = 30;

const productos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.json'), 'utf8'));

// ── Navegador headless para rasterizar las tarjetas ──
function buscarNavegador() {
  const cands = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const b = cands.find(p => fs.existsSync(p));
  if (!b) throw new Error('No encuentro Edge ni Chrome para rasterizar');
  return b;
}

function rasterizar(html, salidaPng) {
  const tmp = path.join(OUT, '_tmp.html');
  fs.writeFileSync(tmp, html, 'utf8');
  execFileSync(buscarNavegador(), [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--screenshot=${salidaPng}`, `--window-size=${W},${H}`,
    'file:///' + tmp.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });
  fs.unlinkSync(tmp);
}

// ── Plantilla de escena ──
const FUENTE = `-apple-system,'Segoe UI',Roboto,sans-serif`;
function escena({ fondo, kicker, titular, cuerpo, pie, acento = '#c8641e' }) {
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${W}px;height:${H}px;font-family:${FUENTE};overflow:hidden;
       background:#1a1512;color:#f6efe7;position:relative}
  .bg{position:absolute;inset:0;background:${fondo ? `url('file:///${fondo.replace(/\\/g, '/')}') center/cover` : 'linear-gradient(160deg,#2b211a,#15100d)'};}
  .veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,12,10,.55) 0%,rgba(15,12,10,.35) 35%,rgba(15,12,10,.92) 100%)}
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:96px 80px 150px}
  .kicker{display:inline-block;align-self:flex-start;background:${acento};color:#fff;
          font-weight:800;font-size:34px;letter-spacing:.14em;text-transform:uppercase;
          padding:16px 28px;border-radius:8px;margin-bottom:36px}
  h1{font-size:${titular.length > 44 ? 74 : 92}px;line-height:1.06;font-weight:900;letter-spacing:-.02em;
     text-shadow:0 6px 40px rgba(0,0,0,.6);margin-bottom:34px}
  p{font-size:44px;line-height:1.4;color:#e2d5c6;font-weight:500}
  .pie{position:absolute;left:80px;right:80px;bottom:64px;display:flex;align-items:center;
       justify-content:space-between;font-size:32px;color:#b9a693;font-weight:600}
  .marca{display:flex;align-items:center;gap:14px}
  .dot{width:14px;height:14px;border-radius:50%;background:${acento}}
  </style>
  <div class="bg"></div><div class="veil"></div>
  <div class="wrap">
    ${kicker ? `<span class="kicker">${kicker}</span>` : ''}
    <h1>${titular}</h1>
    ${cuerpo ? `<p>${cuerpo}</p>` : ''}
  </div>
  <div class="pie">
    <span class="marca"><span class="dot"></span>${settings.tienda.nombre}</span>
    <span>${pie || ''}</span>
  </div>`;
}

// ── Foto IA de ambiente (Pollinations, gratis) ──
function fotoAmbiente(prompt, salida) {
  if (fs.existsSync(salida)) return salida;
  try {
    execSync(`node "${path.join(__dirname, 'gen-image.js')}" "${prompt}" "${salida}" ${W} ${H}`,
      { stdio: 'ignore', cwd: ROOT, timeout: 180000 });
    return fs.existsSync(salida) ? salida : null;
  } catch { return null; }
}

// ── Construye el vídeo de un producto ──
function videoDe(p) {
  const dir = path.join(OUT, p.id);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n🎬 ${p.titulo}`);

  const amb = fotoAmbiente(
    'cinematic photo, rustic woodworking workshop, warm light through window, ' +
    'wood shavings on workbench, hand tools, shallow depth of field, no text, no people faces',
    path.join(dir, 'ambiente.png'));

  const pro = (p.pros && p.pros[0]) || '';
  const contra = (p.contras && p.contras[0]) || '';
  const veredicto = (p.veredicto || '').split('. ')[0] + '.';
  const ahorro = p.precioAntes ? `Antes ${p.precioAntes} → ahora ${p.precio}` : p.precio;

  const escenas = [
    { dur: 3, ...{ fondo: amb, kicker: '16 años de oficio', titular: gancho(p), cuerpo: '', pie: 'El Rincón del Taller' } },
    { dur: 4, ...{ fondo: amb, kicker: 'La herramienta', titular: p.titulo, cuerpo: ahorro, pie: `⭐ ${p.valoracion} · ${p.ventas} vendidos` } },
    { dur: 5, ...{ fondo: amb, kicker: 'Mi veredicto', titular: veredicto, cuerpo: pro ? `✔ ${pro}` : '', pie: 'Sin humo' } },
    { dur: 4, ...{ fondo: amb, kicker: 'Lo que no te dicen', titular: contra || 'Compra con criterio, no por precio', cuerpo: '', pie: 'Contras a la cara', acento: '#8a4b2a' } },
    { dur: 3, ...{ fondo: amb, kicker: 'Enlace en la bio', titular: 'Ficha completa en la tienda', cuerpo: settings.tienda.url.replace('https://', ''), pie: '' } },
  ];

  const lista = [];
  escenas.forEach((e, i) => {
    const png = path.join(dir, `e${i}.png`);
    rasterizar(escena(e), png);
    lista.push({ png, dur: e.dur });
    console.log(`   escena ${i + 1}/5 ✓`);
  });

  // concat con fundidos suaves
  const concat = path.join(dir, 'lista.txt');
  fs.writeFileSync(concat, lista.map(l =>
    `file '${l.png.replace(/\\/g, '/')}'\nduration ${l.dur}`).join('\n') +
    `\nfile '${lista[lista.length - 1].png.replace(/\\/g, '/')}'\n`, 'utf8');

  const salida = path.join(dir, `${p.id}.mp4`);
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concat}" ` +
    `-vf "fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,format=yuv420p" ` +
    `-c:v libx264 -preset medium -crf 21 -movflags +faststart "${salida}"`,
    { stdio: 'ignore', timeout: 300000 });

  const mb = (fs.statSync(salida).size / 1048576).toFixed(1);
  const seg = escenas.reduce((s, e) => s + e.dur, 0);
  console.log(`   ✅ ${salida}  (${seg}s, ${mb} MB)`);
  return salida;
}

function gancho(p) {
  const g = {
    medicion: 'Si tu escuadra miente,\ntodo lo demás sobra',
    corte: 'Un filo bueno\nvale más que la marca',
    sujecion: 'Nunca sobran\nsargentos en el banco',
    electricas: 'La broca barata\nte parte la pieza',
  };
  return (g[p.categoria] || 'Herramienta probada\nen banco de verdad').replace('\n', '<br>');
}

// ── Main ──
const publicables = productos.productos.filter(p => p.affiliateUrl || process.env.BUILD_PREVIEW);
if (!publicables.length) {
  console.log('\n⚠️  No hay productos publicables (ninguno tiene affiliateUrl).');
  console.log('   Para probar el motor igualmente:  BUILD_PREVIEW=1 node scripts/make-video.js\n');
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const arg = process.argv[2];
let objetivo;
if (arg === '--todos') objetivo = publicables;
else if (arg) objetivo = publicables.filter(p => p.id === arg);
else objetivo = [publicables[new Date().getDate() % publicables.length]];

if (!objetivo.length) { console.log('Producto no encontrado'); process.exit(1); }
objetivo.forEach(videoDe);
console.log(`\n🎬 ${objetivo.length} vídeo(s) en social/video/\n`);
