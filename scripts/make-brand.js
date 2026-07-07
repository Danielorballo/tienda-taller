#!/usr/bin/env node
/**
 * Kit de identidad visual: avatar + portadas para cada red.
 * Genera HTML y lo rasteriza con Edge/Chrome headless → social/brand/
 *   avatar.png          1000×1000 (perfil en todas las redes)
 *   portada-fb.png      1640×624  (página de Facebook)
 *   portada-x.png       1500×500  (cabecera de X)
 *   portada-yt.png      2560×1440 (banner de YouTube)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'social', 'brand');
fs.mkdirSync(OUT, { recursive: true });

const SIERRA = `<svg viewBox="0 0 220 200" style="width:100%;height:100%"><g><path d="M30 90 Q120 70 185 88 L185 108 Q120 92 30 106 Z" fill="#e8e8e8" stroke="#9a9a9a" stroke-width="3"/><path d="M38 106 l8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9" stroke="#9a9a9a" stroke-width="3" fill="none"/><rect x="150" y="78" width="55" height="26" rx="10" fill="#c77b30" stroke="#8a5a28" stroke-width="3" transform="rotate(-4 178 91)"/></g></svg>`;

const base = (w, h, inner, extraCSS = '') => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:${w}px;height:${h}px;overflow:hidden;font-family:'Segoe UI',sans-serif;color:#f5ead9;
 background:linear-gradient(160deg,#3d2512 0%,#5a3a1e 55%,#7a5230 100%);
 display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative}
body::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 46px,rgba(255,255,255,.035) 46px 49px)}
h1{font-family:Georgia,serif;text-shadow:0 3px 12px rgba(0,0,0,.45);z-index:1}
.eslogan{font-style:italic;opacity:.92;z-index:1}
.icono{z-index:1}
${extraCSS}</style></head><body>${inner}</body></html>`;

const disenos = {
  'avatar': [1000, 1000, `
    <div class="icono" style="width:430px;height:390px">${SIERRA}</div>
    <h1 style="font-size:112px;line-height:1.05">El Rincón<br>del Taller</h1>`,
    'h1{margin-top:10px}'],
  'portada-fb': [1640, 624, `
    <div style="display:flex;align-items:center;gap:70px;z-index:1">
      <div style="width:330px;height:300px">${SIERRA}</div>
      <div style="text-align:left">
        <h1 style="font-size:92px">El Rincón del Taller</h1>
        <div class="eslogan" style="font-size:40px;margin-top:18px">Herramientas probadas por un carpintero,<br>no por un algoritmo</div>
        <div style="font-size:32px;margin-top:26px;color:#ffcf8a">🪵 16 años de oficio · Consejos a diario · Pros y CONTRAS a la cara</div>
      </div>
    </div>`],
  'portada-x': [1500, 500, `
    <div style="display:flex;align-items:center;gap:60px;z-index:1">
      <div style="width:260px;height:236px">${SIERRA}</div>
      <div style="text-align:left">
        <h1 style="font-size:76px">El Rincón del Taller</h1>
        <div class="eslogan" style="font-size:34px;margin-top:14px">Herramientas probadas por un carpintero, no por un algoritmo</div>
      </div>
    </div>`],
  'portada-yt': [2560, 1440, `
    <div style="z-index:1;max-width:1240px">
      <div class="icono" style="width:360px;height:327px;margin:0 auto">${SIERRA}</div>
      <h1 style="font-size:120px;margin-top:20px">El Rincón del Taller</h1>
      <div class="eslogan" style="font-size:52px;margin-top:24px">Herramientas probadas por un carpintero, no por un algoritmo</div>
      <div style="font-size:40px;margin-top:34px;color:#ffcf8a">Consejos de taller · Reseñas sin humo · 16 años de oficio</div>
    </div>`],
};

const navegadores = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser',
];
const nav = navegadores.find(n => fs.existsSync(n));
if (!nav) { console.error('❌ Sin navegador headless.'); process.exit(1); }

for (const [nombre, [w, h, inner, css]] of Object.entries(disenos)) {
  const html = path.join(OUT, `${nombre}.html`);
  fs.writeFileSync(html, base(w, h, inner, css || ''));
  execFileSync(nav, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--window-size=${w},${h}`, `--screenshot=${path.join(OUT, nombre + '.png')}`,
    'file:///' + html.replace(/\\/g, '/')], { timeout: 30000, stdio: 'pipe' });
  console.log(`✅ ${nombre}.png (${w}×${h})`);
}
console.log(`\nKit de marca en social/brand/ — listos para subir a cada red.`);
