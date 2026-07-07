#!/usr/bin/env node
/**
 * Generador estático de la tienda de afiliados.
 * Uso: node scripts/build.js  →  genera todo en dist/
 * Cero dependencias. Publica SOLO productos con affiliateUrl relleno
 * (salvo BUILD_PREVIEW=1, que publica todo usando urlProducto).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
const PREVIEW = process.env.BUILD_PREVIEW === '1';

const publicados = data.productos.filter(p => p.affiliateUrl || PREVIEW);
const linkDe = p => p.affiliateUrl || p.urlProducto;
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- utilidades comerciales ----------
const num = s => parseFloat(String(s).replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
const descuento = p => {
  if (!p.precioAntes) return 0;
  const antes = num(p.precioAntes), ahora = num(p.precio);
  return antes > ahora ? Math.round((1 - ahora / antes) * 100) : 0;
};
const estrellas = v => {
  if (!v) return '';
  const llenas = Math.round(v);
  return `<span class="stars" title="${v}/5">${'★'.repeat(llenas)}${'☆'.repeat(5 - llenas)} <b>${String(v).replace('.', ',')}</b></span>`;
};
const ventasTxt = p => p.ventas ? `<span class="ventas">🛒 ${p.ventas.toLocaleString('es-ES')}+ vendidos</span>` : '';

// Chollo de la semana: rota determinísticamente por semana ISO entre los que tienen descuento
const semana = Math.floor(Date.now() / (7 * 864e5));
const conDescuento = publicados.filter(p => descuento(p) > 0);
const chollo = conDescuento.length ? conDescuento[semana % conDescuento.length] : publicados[0];

// ---------- ilustraciones SVG por categoría (hasta que haya foto real) ----------
const SVG_DEFS = {
  medicion: `<g stroke="#f5ead9" stroke-width="5" fill="none" stroke-linecap="round"><path d="M40 150 L150 40 L165 55 L55 165 Z" fill="#c77b30" stroke="#8a5a28"/><path d="M60 130 l10 10 M75 115 l10 10 M90 100 l10 10 M105 85 l10 10 M120 70 l10 10" stroke="#4e3016" stroke-width="4"/><rect x="120" y="120" width="60" height="18" rx="4" transform="rotate(45 150 129)" fill="#e0a55e" stroke="#8a5a28"/></g>`,
  corte: `<g><path d="M30 90 Q120 70 185 88 L185 108 Q120 92 30 106 Z" fill="#d8d8d8" stroke="#9a9a9a" stroke-width="3"/><path d="M38 106 l8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9" stroke="#9a9a9a" stroke-width="3" fill="none"/><rect x="150" y="78" width="55" height="26" rx="10" fill="#c77b30" stroke="#8a5a28" stroke-width="3" transform="rotate(-4 178 91)"/></g>`,
  sujecion: `<g stroke="#8a5a28" stroke-width="4" fill="none"><path d="M70 40 h80 v30 h-80 z" fill="#e0a55e"/><path d="M80 70 v70 M140 70 v70" stroke-width="8" stroke="#c77b30"/><rect x="65" y="135" width="90" height="22" rx="6" fill="#c77b30"/><circle cx="110" cy="52" r="9" fill="#4e3016"/><path d="M110 30 v-14" stroke="#4e3016" stroke-width="6"/></g>`,
  electricas: `<g><rect x="45" y="75" width="95" height="55" rx="14" fill="#c77b30" stroke="#8a5a28" stroke-width="4"/><rect x="140" y="88" width="45" height="26" rx="6" fill="#d8d8d8" stroke="#9a9a9a" stroke-width="3"/><path d="M185 101 h20" stroke="#9a9a9a" stroke-width="8" stroke-linecap="round"/><path d="M70 130 l-8 45 h30 l-4-45" fill="#4e3016"/><circle cx="92" cy="102" r="10" fill="#f5ead9"/></g>`,
};
const artSVG = (cat, alto = 190) => {
  const tono = { medicion: '#6b4423', corte: '#59371c', sujecion: '#6b4423', electricas: '#59371c' }[cat] || '#6b4423';
  return `<div class="art" style="height:${alto}px"><svg viewBox="0 0 220 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ilustración">
<defs><radialGradient id="g${cat}" cx="50%" cy="35%"><stop offset="0%" stop-color="${tono}"/><stop offset="100%" stop-color="#3d2512"/></radialGradient></defs>
<rect width="220" height="200" fill="url(#g${cat})"/>${SVG_DEFS[cat] || SVG_DEFS.medicion}</svg></div>`;
};
const mediaDe = (p, alto = 190) => p.imagen
  ? `<img src="${esc(p.imagen)}" alt="${esc(p.titulo)}" loading="lazy" style="height:${alto}px">`
  : artSVG(p.categoria, alto);

// ---------- estilos ----------
const CSS = `
:root{--madera:#7a5230;--madera-osc:#3d2512;--crema:#faf6f0;--tinta:#2b2420;--acento:#c77b30;--acento-vivo:#e08a2e;--rojo:#d9534f;--borde:#e5dcd0;--sombra:0 2px 10px rgba(61,37,18,.10)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--crema);color:var(--tinta);line-height:1.65}
h1,h2,h3,h4{font-family:Georgia,'Times New Roman',serif}
a{color:var(--madera)}
.promo-bar{background:var(--rojo);color:#fff;text-align:center;padding:.45rem .8rem;font-size:.88rem;font-weight:600}
header{background:linear-gradient(160deg,#3d2512 0%,#5a3a1e 55%,#7a5230 100%);color:#f5ead9;padding:2.2rem 1rem 1.8rem;text-align:center;position:relative;overflow:hidden}
header::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 34px,rgba(255,255,255,.03) 34px 36px);pointer-events:none}
header h1{font-size:2.3rem;letter-spacing:1px;text-shadow:0 2px 8px rgba(0,0,0,.35)}
header p{opacity:.9;font-style:italic;margin-top:.4rem;font-size:1.05rem}
nav{background:var(--madera-osc);text-align:center;padding:.6rem;position:sticky;top:0;z-index:10;box-shadow:var(--sombra)}
nav a{color:#f5ead9;text-decoration:none;margin:0 .8rem;font-size:.95rem;padding:.25rem .5rem;border-radius:4px;transition:background .15s}
nav a:hover{background:rgba(255,255,255,.12)}
main{max-width:1020px;margin:0 auto;padding:1.8rem 1rem}
.aviso-afiliado{background:#fdf3e3;border:1px solid var(--borde);border-radius:8px;padding:.6rem .9rem;font-size:.83rem;margin-bottom:1.5rem;color:#6b5138}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1.3rem}
.card{background:#fff;border:1px solid var(--borde);border-radius:12px;padding:1.15rem;display:flex;flex-direction:column;position:relative;box-shadow:var(--sombra);transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-4px);box-shadow:0 8px 22px rgba(61,37,18,.16)}
.card h3{font-size:1.08rem;margin-bottom:.4rem;line-height:1.35}
.card h3 a{text-decoration:none}
.card p{font-size:.9rem;flex:1;color:#4f4238}
.card img,.card .art{width:100%;object-fit:cover;border-radius:8px;margin-bottom:.7rem;background:#eee;overflow:hidden}
.art svg{width:100%;height:100%;display:block}
.precio-linea{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap;margin:.3rem 0}
.precio{color:var(--acento);font-weight:800;font-size:1.35rem}
.precio-antes{color:#9a8a7a;text-decoration:line-through;font-size:.95rem}
.dto{background:var(--rojo);color:#fff;font-size:.78rem;font-weight:800;padding:.12rem .5rem;border-radius:6px}
.stars{color:#e0a52e;font-size:.92rem}.stars b{color:#6b5138}
.ventas{font-size:.82rem;color:#7a6a58}
.social-row{display:flex;gap:.8rem;align-items:center;font-size:.85rem;margin-bottom:.35rem;flex-wrap:wrap}
.badge{position:absolute;top:.7rem;right:.7rem;background:linear-gradient(135deg,#d9534f,#e08a2e);color:#fff;font-size:.72rem;font-weight:700;padding:.22rem .6rem;border-radius:99px;letter-spacing:.4px;box-shadow:0 2px 6px rgba(0,0,0,.25);z-index:2}
.btn{display:inline-block;background:linear-gradient(135deg,var(--acento),var(--acento-vivo));color:#fff;text-decoration:none;padding:.65rem 1.2rem;border-radius:8px;margin-top:.9rem;text-align:center;font-weight:600;box-shadow:0 3px 8px rgba(199,123,48,.35);transition:filter .15s}
.btn:hover{filter:brightness(1.08)}
.btn.secundario{background:transparent;color:var(--madera);border:2px solid var(--acento);box-shadow:none}
h2.seccion{margin:2.2rem 0 1.1rem;padding-bottom:.45rem;border-bottom:3px solid var(--acento);display:inline-block;font-size:1.45rem}
/* Chollo de la semana */
.chollo{display:grid;grid-template-columns:340px 1fr;gap:1.6rem;background:linear-gradient(135deg,#fff 60%,#fdf0dd);border:2px solid var(--acento);border-radius:14px;padding:1.5rem;margin:1.4rem 0 2rem;box-shadow:0 6px 24px rgba(199,123,48,.18);position:relative}
.chollo .cinta{position:absolute;top:-14px;left:22px;background:var(--rojo);color:#fff;font-weight:800;padding:.35rem 1rem;border-radius:8px;font-size:.95rem;box-shadow:0 3px 8px rgba(0,0,0,.25)}
.chollo img,.chollo .art{width:100%;border-radius:10px;object-fit:cover;overflow:hidden}
.chollo h3{font-size:1.5rem;margin-bottom:.5rem}
.chollo .precio{font-size:2rem}
.chollo p{color:#4f4238;margin:.5rem 0}
/* Confianza */
.confianza{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin:1.6rem 0}
.confianza div{background:#fff;border:1px solid var(--borde);border-radius:10px;padding:.9rem 1rem;text-align:center;font-size:.88rem;box-shadow:var(--sombra)}
.confianza b{display:block;font-size:1.05rem;margin-bottom:.2rem}
/* Historia */
.historia{background:linear-gradient(160deg,#3d2512,#5a3a1e);color:#f0e4d2;border-radius:14px;padding:1.8rem;margin:2.2rem 0;display:grid;grid-template-columns:64px 1fr;gap:1.2rem;align-items:start}
.historia .icono{font-size:2.6rem;line-height:1}
.historia h3{color:#ffcf8a;margin-bottom:.5rem;font-size:1.3rem}
.historia p{font-size:.95rem;opacity:.95}
.ficha{background:#fff;border:1px solid var(--borde);border-radius:12px;padding:1.8rem;box-shadow:var(--sombra)}
.ficha .precio{font-size:1.9rem}
.ficha img,.ficha .art{max-width:420px;border-radius:10px;overflow:hidden}
.pros-contras{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1.2rem 0}
.pros,.contras{border-radius:8px;padding:.9rem 1rem}
.pros{background:#f0f7f0;border:1px solid #d3e6d3}.contras{background:#fbf2ea;border:1px solid #eddcc8}
.pros-contras ul{padding-left:1.2rem;font-size:.92rem;margin-top:.4rem}
.pros h4{color:#2e7d32}.contras h4{color:#b3541e}
article.post{background:#fff;border:1px solid var(--borde);border-radius:12px;padding:1.8rem;box-shadow:var(--sombra)}
article.post h2,article.post h3{margin:1.2rem 0 .5rem}
article.post p,article.post li{margin-bottom:.7rem}
footer{background:var(--madera-osc);color:#d9c9b3;text-align:center;padding:1.8rem 1rem;margin-top:3rem;font-size:.85rem}
footer a{color:#f5ead9;margin:0 .5rem}
@media(max-width:720px){.chollo{grid-template-columns:1fr}.pros-contras{grid-template-columns:1fr}header h1{font-size:1.7rem}.historia{grid-template-columns:1fr}}
`;

function page(titulo, cuerpo, { descripcion = cfg.tienda.descripcion, ruta = '' } = {}) {
  const prefix = ruta.includes('/') ? '../' : '';
  return `<!DOCTYPE html>
<html lang="${cfg.tienda.idioma}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} — ${esc(cfg.tienda.nombre)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${cfg.tienda.url}/${ruta}">
<style>${CSS}</style>
</head>
<body>
<div class="promo-bar">⚡ Chollo de la semana: ${esc(chollo?.titulo || 'próximamente')}${chollo && descuento(chollo) ? ` — ${descuento(chollo)}% de descuento` : ''} · <a href="${prefix}producto/${chollo?.id}.html" style="color:#fff">verlo →</a></div>
<header><h1>${esc(cfg.tienda.nombre)}</h1><p>${esc(cfg.tienda.eslogan)}</p></header>
<nav><a href="${prefix}index.html">Inicio</a>${data.categorias.map(c => `<a href="${prefix}categoria/${c.id}.html">${esc(c.nombre)}</a>`).join('')}<a href="${prefix}guias.html">Guías</a></nav>
<main>
${cuerpo}
<div class="aviso-afiliado">ℹ️ Este sitio contiene enlaces de afiliado de AliExpress: si compras a través de ellos recibimos una pequeña comisión sin coste extra para ti. Solo recomendamos herramientas que compraríamos para nuestro propio taller.</div>
</main>
<footer>
<p>© ${new Date().getFullYear()} ${esc(cfg.tienda.nombre)}</p>
<p><a href="${prefix}legal/aviso-legal.html">Aviso legal</a> · <a href="${prefix}legal/privacidad.html">Privacidad</a> · <a href="${prefix}legal/cookies.html">Cookies</a> · <a href="${prefix}legal/afiliados.html">Política de afiliados</a></p>
</footer>
</body></html>`;
}

const cardProducto = (p, prefix = '') => {
  const dto = descuento(p);
  return `
<div class="card">
${p.tendencia ? '<span class="badge">🔥 Tendencia</span>' : (dto >= 30 ? `<span class="badge">💥 -${dto}%</span>` : '')}
<a href="${prefix}producto/${p.id}.html">${mediaDe(p)}</a>
<h3><a href="${prefix}producto/${p.id}.html">${esc(p.titulo)}</a></h3>
<div class="social-row">${estrellas(p.valoracion)}${ventasTxt(p)}</div>
<div class="precio-linea"><span class="precio">${esc(p.precio)}</span>${p.precioAntes ? `<span class="precio-antes">${esc(p.precioAntes)}</span>` : ''}${dto ? `<span class="dto">-${dto}%</span>` : ''}</div>
<p>${esc(p.veredicto.slice(0, 130))}…</p>
<a class="btn" href="${esc(linkDe(p))}" rel="nofollow sponsored noopener" target="_blank">Ver en AliExpress →</a>
</div>`;
};

// --- Generación ---
fs.rmSync(DIST, { recursive: true, force: true });
for (const d of ['', 'categoria', 'producto', 'legal', 'guias']) fs.mkdirSync(path.join(DIST, d), { recursive: true });

// Guías (leídas antes para poder destacarlas en la portada)
const artDir = path.join(ROOT, 'content', 'articles');
const arts = fs.existsSync(artDir) ? fs.readdirSync(artDir).filter(f => f.endsWith('.html')) : [];
const indiceGuias = [];
for (const f of arts) {
  const html = fs.readFileSync(path.join(artDir, f), 'utf8');
  const titulo = (html.match(/<h2>(.*?)<\/h2>/) || [, f])[1];
  const extracto = (html.match(/<p>(.*?)<\/p>/s) || [, ''])[1].replace(/<[^>]+>/g, '').slice(0, 150);
  indiceGuias.push({ slug: f.replace(/\.html$/, ''), titulo, extracto, html });
}

// Índice
const enTendencia = publicados.filter(p => p.tendencia);
const resto = publicados.filter(p => !p.tendencia && p.id !== chollo?.id);
const dtoChollo = chollo ? descuento(chollo) : 0;

const bloqueChollo = chollo ? `
<div class="chollo">
  <span class="cinta">⚡ CHOLLO DE LA SEMANA</span>
  <div>${mediaDe(chollo, 260)}</div>
  <div>
    <h3>${esc(chollo.titulo)}</h3>
    <div class="social-row">${estrellas(chollo.valoracion)}${ventasTxt(chollo)}</div>
    <div class="precio-linea"><span class="precio">${esc(chollo.precio)}</span>${chollo.precioAntes ? `<span class="precio-antes">${esc(chollo.precioAntes)}</span>` : ''}${dtoChollo ? `<span class="dto">-${dtoChollo}%</span>` : ''}</div>
    <p>${esc(chollo.veredicto)}</p>
    <a class="btn" href="${esc(linkDe(chollo))}" rel="nofollow sponsored noopener" target="_blank">Ver la oferta en AliExpress →</a>
    <a class="btn secundario" href="producto/${chollo.id}.html">Pros y contras completos</a>
  </div>
</div>` : '';

const bloqueConfianza = `
<div class="confianza">
  <div><b>🪵 16 años de oficio</b>Cada producto lo elige un carpintero profesional, no un algoritmo</div>
  <div><b>✘ Contras a la cara</b>Publicamos lo malo de cada herramienta, no solo lo bueno</div>
  <div><b>🛡️ Compra protegida</b>Pagas en AliExpress con su garantía de devolución</div>
  <div><b>🔥 Radar de chollos</b>Buscamos ofertas y novedades del nicho cada día</div>
</div>`;

const bloqueHistoria = `
<div class="historia">
  <div class="icono">🪚</div>
  <div>
    <h3>¿Quién elige estas herramientas?</h3>
    <p>Dieciséis años viviendo de la carpintería artesanal, sin máquinas: encajes a mano, precisión de décima y muchas herramientas compradas — algunas excelentes y otras directamente al cajón de la vergüenza. Esta tienda existe para que tú no pagues ese aprendizaje: aquí solo entra lo que pondría en mi propio banco de trabajo, con sus defectos contados antes de que compres.</p>
  </div>
</div>`;

const bloqueGuias = indiceGuias.length ? `
<h2 class="seccion">📖 Guías del taller</h2>
<div class="grid">${indiceGuias.map(a => `
  <div class="card"><h3><a href="guias/${a.slug}.html">${esc(a.titulo)}</a></h3><p>${esc(a.extracto)}…</p><a class="btn secundario" href="guias/${a.slug}.html">Leer guía →</a></div>`).join('')}
</div>` : '';

fs.writeFileSync(path.join(DIST, 'index.html'), page('Inicio',
  `${bloqueChollo}
   ${bloqueConfianza}
   ${enTendencia.length ? `<h2 class="seccion">🔥 En tendencia ahora</h2><div class="grid">${enTendencia.map(p => cardProducto(p)).join('')}</div>` : ''}
   <h2 class="seccion">🧰 Selección del taller</h2><div class="grid">${resto.map(p => cardProducto(p)).join('') || '<p>Catálogo en construcción — pronto habrá productos.</p>'}</div>
   ${bloqueHistoria}
   ${bloqueGuias}
   <h2 class="seccion">Categorías</h2><div class="grid">${data.categorias.map(c =>
    `<div class="card">${artSVG(c.id, 120)}<h3><a href="categoria/${c.id}.html">${esc(c.nombre)}</a></h3><p>${esc(c.descripcion)}</p></div>`).join('')}</div>`,
  { ruta: 'index.html' }));

// Categorías
for (const c of data.categorias) {
  const prods = publicados.filter(p => p.categoria === c.id).map(p => cardProducto(p, '../')).join('');
  fs.writeFileSync(path.join(DIST, 'categoria', `${c.id}.html`), page(c.nombre,
    `<h2 class="seccion">${esc(c.nombre)}</h2><p>${esc(c.descripcion)}</p><div class="grid">${prods || '<p>Pronto añadiremos herramientas en esta categoría.</p>'}</div>`,
    { descripcion: c.descripcion, ruta: `categoria/${c.id}.html` }));
}

// Fichas de producto
for (const p of publicados) {
  const dto = descuento(p);
  fs.writeFileSync(path.join(DIST, 'producto', `${p.id}.html`), page(p.titulo,
    `<div class="ficha">
      ${mediaDe(p, 280)}
      <h2>${esc(p.titulo)}</h2>
      <div class="social-row">${estrellas(p.valoracion)}${ventasTxt(p)}</div>
      <div class="precio-linea"><span class="precio">${esc(p.precio)}</span>${p.precioAntes ? `<span class="precio-antes">${esc(p.precioAntes)}</span>` : ''}${dto ? `<span class="dto">-${dto}%</span>` : ''}</div>
      <p style="margin:1rem 0">${esc(p.veredicto)}</p>
      <div class="pros-contras">
        <div class="pros"><h4>✔ A favor</h4><ul>${p.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="contras"><h4>✘ En contra</h4><ul>${p.contras.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
      <a class="btn" href="${esc(linkDe(p))}" rel="nofollow sponsored noopener" target="_blank">Ver precio en AliExpress →</a>
    </div>`,
    { descripcion: p.veredicto.slice(0, 155), ruta: `producto/${p.id}.html` }));
}

// Guías
for (const a of indiceGuias) {
  fs.writeFileSync(path.join(DIST, 'guias', `${a.slug}.html`),
    page(a.titulo, `<article class="post">${a.html}</article>`, { descripcion: a.extracto, ruta: `guias/${a.slug}.html` }));
}
fs.writeFileSync(path.join(DIST, 'guias.html'), page('Guías del taller',
  `<h2 class="seccion">Guías del taller</h2><div class="grid">${indiceGuias.map(a =>
    `<div class="card"><h3><a href="guias/${a.slug}.html">${esc(a.titulo)}</a></h3><p>${esc(a.extracto)}…</p><a class="btn secundario" href="guias/${a.slug}.html">Leer guía →</a></div>`).join('') || '<p>Próximamente.</p>'}</div>`,
  { ruta: 'guias.html' }));

// Páginas legales (se rellenan con config/settings.json)
const t = cfg.titular;
const legales = {
  'aviso-legal': ['Aviso legal', `
<h2>Aviso legal</h2>
<p>En cumplimiento de la Ley 34/2002 (LSSI-CE), se informa de que el titular de este sitio web es:</p>
<ul><li><strong>Titular:</strong> ${esc(t.nombre)}</li><li><strong>NIF:</strong> ${esc(t.nif)}</li><li><strong>Domicilio:</strong> ${esc(t.domicilio)}</li><li><strong>Email de contacto:</strong> ${esc(t.email)}</li></ul>
<p><strong>Actividad:</strong> ${esc(cfg.legal.actividad)}. ${esc(cfg.legal.registroMercantil)}.</p>
<p>Este sitio no vende productos: redirige a AliExpress, donde se realiza la compra. Toda transacción, envío, garantía y devolución es responsabilidad de AliExpress y del vendedor correspondiente.</p>`],
  'privacidad': ['Política de privacidad', `
<h2>Política de privacidad</h2>
<p>Responsable: ${esc(t.nombre)} (NIF ${esc(t.nif)}), email ${esc(t.email)}.</p>
<p>Este sitio es estático y <strong>no recoge datos personales directamente</strong>: no hay formularios, registro ni comentarios. Al hacer clic en un enlace de afiliado, AliExpress puede instalar cookies propias según su propia política de privacidad.</p>
<p>Derechos RGPD (acceso, rectificación, supresión, oposición): escribiendo a ${esc(t.email)}.</p>`],
  'cookies': ['Política de cookies', `
<h2>Política de cookies</h2>
<p>Este sitio no instala cookies propias. Los enlaces salientes a AliExpress incorporan parámetros de seguimiento de afiliación, y AliExpress puede instalar cookies de terceros en su propio dominio al visitarlo, conforme a su política de cookies.</p>`],
  'afiliados': ['Política de afiliados', `
<h2>Política de afiliados</h2>
<p>${esc(cfg.tienda.nombre)} participa en el programa de afiliados de AliExpress (AliExpress Portals). Esto significa que <strong>recibimos una comisión</strong> cuando compras a través de nuestros enlaces, <strong>sin coste adicional para ti</strong>.</p>
<p>Las opiniones publicadas son propias y se basan en experiencia real de taller. La comisión no condiciona el veredicto: publicamos pros y contras de cada herramienta.</p>
<p>Los precios y descuentos mostrados provienen de AliExpress y son orientativos; el precio válido es siempre el que muestre AliExpress en el momento de la compra.</p>`],
};
for (const [slug, [titulo, cuerpo]] of Object.entries(legales)) {
  fs.writeFileSync(path.join(DIST, 'legal', `${slug}.html`), page(titulo, cuerpo, { ruta: `legal/${slug}.html` }));
}

// Sitemap + robots
const rutas = ['index.html', 'guias.html',
  ...data.categorias.map(c => `categoria/${c.id}.html`),
  ...publicados.map(p => `producto/${p.id}.html`),
  ...indiceGuias.map(a => `guias/${a.slug}.html`)];
fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  rutas.map(r => `<url><loc>${cfg.tienda.url}/${r}</loc></url>`).join('\n') + '\n</urlset>');
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${cfg.tienda.url}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

console.log(`✅ Sitio generado en dist/ — ${publicados.length} productos publicados` +
  (PREVIEW ? ' (MODO PREVIEW: enlaces sin afiliado)' : '') +
  `, ${data.productos.length - publicados.length} pendientes de enlace de afiliado, ${indiceGuias.length} guías. Chollo de la semana: ${chollo ? chollo.titulo : '—'}`);
