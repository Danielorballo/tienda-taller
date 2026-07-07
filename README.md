# El Rincón del Taller — tienda de afiliados AliExpress

Tienda estática, gratuita y automatizada de marketing de afiliados (nicho: herramientas y taller de carpintería). Sin servidores, sin costes: se genera con Node y se publica sola en GitHub Pages cada vez que haces push (y cada mañana por cron).

## 🚀 Puesta en marcha — SOLO 3 pasos tuyos

### Paso 1 — Cuenta de afiliado AliExpress Portals (~10 min, gratis)
1. Entra en **https://portals.aliexpress.com** y regístrate con tu cuenta de AliExpress.
2. Rellena el formulario: nombre, país (España), tipo (individual), método de cobro y **tu web** (pon la URL de GitHub Pages del paso 3, o una red social mientras tanto).
3. Al aprobarte tendrás un **Tracking ID** → cópialo en `config/settings.json` (`afiliado.trackingId`).
4. Para cada producto: en Portals → *Ad Center → Deep Link*, pegas la URL del producto y te devuelve el enlace de afiliado (`https://s.click.aliexpress.com/e/...`).

### Paso 2 — Tus datos en `config/settings.json`
Rellena todo lo que empieza por `RELLENAR_`: nombre, NIF, domicilio fiscal y email. Con eso se generan automáticamente el aviso legal, privacidad, cookies y política de afiliados (obligatorios por LSSI/RGPD en España).

### Paso 3 — Publicar en GitHub Pages (gratis)
```bash
cd C:\Users\black\Projects\tienda-taller
git init && git add -A && git commit -m "Tienda inicial"
# crea el repo en GitHub (público) y súbelo:
gh repo create tienda-taller --public --source . --push
```
Luego en GitHub → **Settings → Pages → Source: GitHub Actions**. En 2 minutos la tienda está en `https://TU_USUARIO.github.io/tienda-taller`. A partir de ahí **cada push la regenera y publica sola**, y el cron de las 05:00 UTC la reconstruye a diario.

## 🛠️ Uso diario

| Quiero… | Comando |
|---|---|
| Añadir un producto | `node scripts/add-product.js --titulo "..." --precio "12 €" --categoria corte --url "..." --afiliado "https://s.click.aliexpress.com/e/..." --veredicto "..."` |
| Regenerar el sitio en local | `node scripts/build.js` |
| Verlo antes de publicar | `BUILD_PREVIEW=1 node scripts/build.js` y abrir `dist/index.html` |
| Escribir una guía | Crear un `.html` en `content/articles/` (primer `<h2>` = título) |
| Publicar cambios | `git add -A && git commit -m "..." && git push` |

**Regla de seguridad**: un producto sin `affiliateUrl` NO se publica (para no regalar clics sin comisión). El modo `BUILD_PREVIEW=1` los muestra igualmente para revisar en local.

## 📣 Automatización de redes sociales

Cada día a las 10:30 (Madrid) el workflow `social.yml` hace solo:
1. **Radar de tendencias** (`scripts/trending.js`): consulta la API de afiliados de AliExpress (productos calientes del nicho, rating ≥4.6, ≥300 ventas), añade hasta 3/día al catálogo con enlace de afiliado ya generado y etiqueta 🔥 Tendencia (caduca a los 14 días). *Requiere App Key/Secret — ver abajo.*
2. **Fábrica de publicaciones** (`scripts/make-posts.js`): elige el producto del día (rotación, tendencias primero) y genera texto para X, Facebook, Instagram, TikTok y YouTube + tarjetas de imagen 1080×1080 y 1080×1920.
3. **Publicador** (`scripts/publish.js`): publica automáticamente en **X, Facebook e Instagram**. **El anuncio enlaza a tu ficha de producto en la tienda** (los enlaces de afiliado en crudo los penalizan las plataformas). TikTok/YouTube: el pack (guion + caption + tarjeta vertical) queda en `social/out/<fecha>/` para subirlo en 1 minuto — automatización total en fase 2 (sus APIs exigen vídeo y aprobación de app).

Probar en local: `node scripts/make-posts.js` y mira `social/out/<hoy>/`.

### Credenciales (todas gratis) — se guardan en GitHub → Settings → Secrets → Actions
| Secret | De dónde sale |
|---|---|
| `ALIEXPRESS_APP_KEY` / `ALIEXPRESS_APP_SECRET` | openservice.aliexpress.com → crear app (categoría Affiliate) con tu cuenta Portals |
| `X_API_KEY` `X_API_SECRET` `X_ACCESS_TOKEN` `X_ACCESS_SECRET` | developer.x.com → plan Free → crear app → Keys and tokens (permisos Read+Write) |
| `FB_PAGE_ID` / `FB_PAGE_TOKEN` | Crear **página** de Facebook → developers.facebook.com → app → Graph API → Page Access Token (larga duración) |
| `IG_USER_ID` | Cuenta Instagram **profesional** vinculada a esa página de Facebook (mismo token) |

Sin un secret, esa red simplemente se salta — nada se rompe.

## ⚠️ Realidad del negocio (léelo)
- La tienda es el escaparate; **el trabajo real es el contenido y el tráfico**. Cada guía tipo las de `content/articles/` es lo que puede posicionar en Google — el catálogo solo, no.
- Fiscalidad España: las comisiones de afiliación son rendimientos que se declaran. Si es actividad recurrente → alta censal (modelo 036) como actividad económica. Consúltalo con tu gestor antes del primer cobro.
- Comisiones AliExpress: 3-9% según categoría, cobro vía Portals con mínimo de pago.

## 📁 Estructura
```
config/settings.json    ← ÚNICO fichero a rellenar (datos personales/fiscales/afiliado)
data/products.json      ← catálogo
content/articles/       ← guías SEO
scripts/build.js        ← generador (cero dependencias)
scripts/add-product.js  ← añadir producto por CLI
.github/workflows/      ← build + deploy automático (push + cron diario)
dist/                   ← salida generada (no editar a mano)
```
