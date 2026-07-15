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
:root{--madera:#6b4423;--madera-osc:#2a1a0e;--crema:#f7f2ea;--papel:#fffdfa;--tinta:#241d17;--suave:#5c4f43;--acento:#c9782e;--acento-vivo:#e0913a;--rojo:#c0472e;--borde:#e9e0d3;--sombra:0 6px 22px rgba(42,26,14,.08);--sombra-alta:0 14px 40px rgba(42,26,14,.16)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--crema);color:var(--tinta);line-height:1.68;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{font-family:'Fraunces','Georgia',serif;font-weight:600;letter-spacing:-.01em}
a{color:var(--madera)}
img{max-width:100%}
.promo-bar{background:var(--madera-osc);color:#f3e6d4;text-align:center;padding:.5rem .8rem;font-size:.86rem;font-weight:500;letter-spacing:.01em}
.promo-bar a{color:#ffcf8a;font-weight:700}
/* Hero portada */
.hero{position:relative;min-height:64vh;display:flex;align-items:flex-end;background-size:cover;background-position:center;color:#fff}
.hero-inner{position:relative;z-index:2;max-width:1080px;margin:0 auto;width:100%;padding:2.6rem 1.3rem 3rem}
.hero h1{font-size:clamp(2.4rem,5vw,4rem);line-height:1.02;text-shadow:0 2px 24px rgba(0,0,0,.45);max-width:15ch}
.hero .lema{font-size:clamp(1.05rem,2vw,1.35rem);margin-top:.9rem;max-width:44ch;color:#f3e7d7;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.hero-cta{display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1.6rem}
/* Header interior */
.topbar{background:var(--madera-osc);color:#f3e6d4;padding:1.1rem 1.3rem;display:flex;align-items:baseline;gap:1rem;flex-wrap:wrap}
.topbar .brand{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:600;color:#fff;text-decoration:none}
.topbar .tagline{font-size:.9rem;color:#c9b7a0;font-style:italic}
nav{background:var(--papel);border-bottom:1px solid var(--borde);text-align:center;padding:.55rem;position:sticky;top:0;z-index:20;box-shadow:0 2px 12px rgba(42,26,14,.05)}
nav a{color:var(--madera);text-decoration:none;margin:0 .5rem;font-size:.92rem;font-weight:500;padding:.35rem .7rem;border-radius:99px;transition:background .15s,color .15s}
nav a:hover{background:var(--madera);color:#fff}
main{max-width:1080px;margin:0 auto;padding:2.2rem 1.3rem}
.aviso-afiliado{background:#fbf1e0;border:1px solid var(--borde);border-radius:12px;padding:.7rem 1rem;font-size:.82rem;margin-bottom:1.5rem;color:#6b5138}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(266px,1fr));gap:1.4rem}
.card{background:var(--papel);border:1px solid var(--borde);border-radius:16px;padding:1.2rem;display:flex;flex-direction:column;position:relative;box-shadow:var(--sombra);transition:transform .18s,box-shadow .18s}
.card:hover{transform:translateY(-5px);box-shadow:var(--sombra-alta)}
.card h3{font-size:1.12rem;margin-bottom:.4rem;line-height:1.3}
.card h3 a{text-decoration:none}
.card p{font-size:.9rem;flex:1;color:var(--suave)}
.card img,.card .art{width:100%;object-fit:cover;border-radius:11px;margin-bottom:.8rem;background:#eee;overflow:hidden}
.art svg{width:100%;height:100%;display:block}
.precio-linea{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap;margin:.35rem 0}
.precio{color:var(--acento);font-weight:800;font-size:1.4rem;font-family:'Inter',sans-serif}
.precio-antes{color:#a8998a;text-decoration:line-through;font-size:.95rem}
.dto{background:var(--rojo);color:#fff;font-size:.76rem;font-weight:800;padding:.14rem .5rem;border-radius:6px}
.stars{color:#e0a52e;font-size:.9rem}.stars b{color:#6b5138}
.ventas{font-size:.8rem;color:#8a7a68}
.social-row{display:flex;gap:.8rem;align-items:center;font-size:.85rem;margin-bottom:.35rem;flex-wrap:wrap}
.badge{position:absolute;top:.8rem;right:.8rem;background:rgba(42,26,14,.82);backdrop-filter:blur(4px);color:#fff;font-size:.72rem;font-weight:700;padding:.28rem .7rem;border-radius:99px;letter-spacing:.3px;box-shadow:0 2px 8px rgba(0,0,0,.25);z-index:2}
.btn{display:inline-block;background:linear-gradient(135deg,var(--acento),var(--acento-vivo));color:#fff;text-decoration:none;padding:.72rem 1.35rem;border-radius:10px;margin-top:.9rem;text-align:center;font-weight:600;font-size:.95rem;box-shadow:0 4px 14px rgba(201,120,46,.34);transition:transform .15s,filter .15s}
.btn:hover{filter:brightness(1.06);transform:translateY(-1px)}
.btn.secundario{background:transparent;color:var(--madera);border:2px solid var(--acento);box-shadow:none}
.btn.claro{background:rgba(255,255,255,.14);color:#fff;border:2px solid rgba(255,255,255,.55);backdrop-filter:blur(3px)}
h2.seccion{margin:2.6rem 0 1.2rem;font-size:1.7rem;position:relative;padding-left:.9rem}
h2.seccion::before{content:"";position:absolute;left:0;top:.15em;bottom:.15em;width:5px;border-radius:4px;background:linear-gradient(var(--acento),var(--acento-vivo))}
/* Chollo de la semana */
.chollo{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:1.8rem;background:linear-gradient(135deg,var(--papel) 55%,#fbeed9);border:1px solid var(--borde);border-radius:20px;padding:1.7rem;margin:0 0 2.2rem;box-shadow:var(--sombra-alta);position:relative}
.chollo .cinta{position:absolute;top:-15px;left:24px;background:linear-gradient(135deg,var(--rojo),#d9663f);color:#fff;font-weight:800;padding:.4rem 1.1rem;border-radius:99px;font-size:.85rem;letter-spacing:.03em;box-shadow:0 4px 12px rgba(0,0,0,.22)}
.chollo img,.chollo .art{width:100%;border-radius:14px;object-fit:cover;overflow:hidden}
.chollo h3{font-size:1.7rem;margin-bottom:.5rem;line-height:1.12}
.chollo .precio{font-size:2.2rem}
.chollo p{color:var(--suave);margin:.5rem 0}
/* Confianza */
.confianza{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1rem;margin:1.8rem 0}
.confianza div{background:var(--papel);border:1px solid var(--borde);border-radius:14px;padding:1.1rem 1rem;text-align:center;font-size:.86rem;color:var(--suave);box-shadow:var(--sombra)}
.confianza b{display:block;font-family:'Fraunces',serif;font-size:1.02rem;color:var(--tinta);margin-bottom:.25rem}
/* Categorías con foto */
.cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:1.3rem}
.cat-tile{position:relative;display:block;height:190px;border-radius:16px;overflow:hidden;text-decoration:none;box-shadow:var(--sombra);transition:transform .18s,box-shadow .18s}
.cat-tile:hover{transform:translateY(-5px);box-shadow:var(--sombra-alta)}
.cat-tile img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.cat-tile:hover img{transform:scale(1.06)}
.cat-tile .capa{position:absolute;inset:0;background:linear-gradient(to top,rgba(20,12,6,.82) 8%,rgba(20,12,6,.15) 55%,transparent);display:flex;flex-direction:column;justify-content:flex-end;padding:1.1rem}
.cat-tile h3{color:#fff;font-size:1.22rem;text-shadow:0 1px 8px rgba(0,0,0,.5)}
.cat-tile span{color:#e9d9c5;font-size:.82rem;margin-top:.2rem}
/* Historia */
.historia{background:linear-gradient(150deg,#2a1a0e,#553venue);background:linear-gradient(150deg,#2a1a0e,#553318);color:#f0e4d2;border-radius:20px;padding:2.2rem;margin:2.6rem 0;display:grid;grid-template-columns:70px 1fr;gap:1.4rem;align-items:start;box-shadow:var(--sombra-alta)}
.historia .icono{font-size:3rem;line-height:1}
.historia h3{color:#ffcf8a;margin-bottom:.6rem;font-size:1.5rem}
.historia p{font-size:.98rem;opacity:.95}
.ficha{background:var(--papel);border:1px solid var(--borde);border-radius:18px;padding:2rem;box-shadow:var(--sombra)}
.ficha .precio{font-size:2rem}
.ficha img,.ficha .art{max-width:440px;border-radius:14px;overflow:hidden}
.pros-contras{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1.3rem 0}
.pros,.contras{border-radius:12px;padding:1rem 1.1rem}
.pros{background:#eef6ee;border:1px solid #d3e6d3}.contras{background:#fbf1e8;border:1px solid #eddcc8}
.pros-contras ul{padding-left:1.2rem;font-size:.92rem;margin-top:.4rem}
.pros h4{color:#2e7d32}.contras h4{color:#b3541e}
article.post{background:var(--papel);border:1px solid var(--borde);border-radius:18px;padding:2.2rem;box-shadow:var(--sombra);font-size:1.02rem}
article.post h2,article.post h3{margin:1.4rem 0 .6rem}
article.post p,article.post li{margin-bottom:.75rem}
footer{background:var(--madera-osc);color:#c9b7a0;text-align:center;padding:2.4rem 1rem;margin-top:3.5rem;font-size:.85rem}
footer a{color:#f3e6d4;margin:0 .5rem}
@media(max-width:720px){.chollo{grid-template-columns:1fr}.pros-contras{grid-template-columns:1fr}.historia{grid-template-columns:1fr}.hero{min-height:56vh}}
`;

function page(titulo, cuerpo, { descripcion = cfg.tienda.descripcion, ruta = '', hero = '' } = {}) {
  const prefix = ruta.includes('/') ? '../' : '';
  const cabecera = hero || `<header class="topbar"><a class="brand" href="${prefix}index.html">${esc(cfg.tienda.nombre)}</a><span class="tagline">${esc(cfg.tienda.eslogan)}</span></header>`;
  return `<!DOCTYPE html>
<html lang="${cfg.tienda.idioma}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} — ${esc(cfg.tienda.nombre)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${cfg.tienda.url}/${ruta}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="promo-bar">⚡ Chollo de la semana: ${esc(chollo?.titulo || 'próximamente')}${chollo && descuento(chollo) ? ` — ${descuento(chollo)}% de descuento` : ''} · <a href="${prefix}producto/${chollo?.id}.html">verlo →</a></div>
${cabecera}
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
for (const d of ['', 'categoria', 'producto', 'legal', 'guias', 'assets', 'assets/cat']) fs.mkdirSync(path.join(DIST, d), { recursive: true });

// Copiar imágenes de marca (hero + categorías) a dist/assets si existen
const BRAND = path.join(ROOT, 'social', 'brand');
const heroSrc = path.join(BRAND, 'hero', 'hero-taller.png');
const hayHero = fs.existsSync(heroSrc);
if (hayHero) fs.copyFileSync(heroSrc, path.join(DIST, 'assets', 'hero-taller.png'));
const catFoto = {};
for (const c of data.categorias) {
  const src = path.join(BRAND, 'cat', `${c.id}.png`);
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(DIST, 'assets', 'cat', `${c.id}.png`)); catFoto[c.id] = true; }
}
// Tarjeta de categoría: foto real con capa de texto, o SVG de reserva
const catTile = (c, prefix = '') => catFoto[c.id]
  ? `<a class="cat-tile" href="${prefix}categoria/${c.id}.html"><img src="${prefix}assets/cat/${c.id}.png" alt="${esc(c.nombre)}" loading="lazy"><span class="capa"><h3>${esc(c.nombre)}</h3><span>${esc(c.descripcion)}</span></span></a>`
  : `<div class="card">${artSVG(c.id, 150)}<h3><a href="${prefix}categoria/${c.id}.html">${esc(c.nombre)}</a></h3><p>${esc(c.descripcion)}</p></div>`;

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

const heroPortada = `<header class="hero" style="background-image:linear-gradient(90deg,rgba(20,12,6,.55),rgba(20,12,6,.15)),${hayHero ? "url('assets/hero-taller.png')" : 'linear-gradient(150deg,#2a1a0e,#6b4423)'}">
  <div class="hero-inner">
    <h1>${esc(cfg.tienda.nombre)}</h1>
    <p class="lema">${esc(cfg.tienda.eslogan)}</p>
    <div class="hero-cta"><a class="btn" href="#seleccion">Ver la selección</a><a class="btn claro" href="guias.html">Guías del taller</a></div>
  </div>
</header>`;

fs.writeFileSync(path.join(DIST, 'index.html'), page('Inicio',
  `${bloqueChollo}
   ${bloqueConfianza}
   ${enTendencia.length ? `<h2 class="seccion">🔥 En tendencia ahora</h2><div class="grid">${enTendencia.map(p => cardProducto(p)).join('')}</div>` : ''}
   <h2 class="seccion" id="seleccion">🧰 Selección del taller</h2><div class="grid">${resto.map(p => cardProducto(p)).join('') || '<p>Catálogo en construcción — pronto habrá productos.</p>'}</div>
   ${bloqueHistoria}
   ${bloqueGuias}
   <h2 class="seccion">Explora por categoría</h2><div class="cats">${data.categorias.map(c => catTile(c)).join('')}</div>`,
  { ruta: 'index.html', hero: heroPortada }));

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
