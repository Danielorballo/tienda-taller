#!/usr/bin/env node
/**
 * Añadir un producto al catálogo desde la terminal.
 * Uso:
 *   node scripts/add-product.js --titulo "Sierra japonesa" --precio "18,50 €" \
 *     --categoria corte --url "https://es.aliexpress.com/item/xxx.html" \
 *     --afiliado "https://s.click.aliexpress.com/e/xxxx" \
 *     --veredicto "Por qué la recomiendo..." [--imagen URL] [--pros "a|b|c"] [--contras "x|y"]
 */
const fs = require('fs');
const path = require('path');

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];

const obligatorios = ['titulo', 'precio', 'categoria', 'url', 'veredicto'];
const faltan = obligatorios.filter(k => !args[k]);
if (faltan.length) {
  console.error(`❌ Faltan campos: ${faltan.join(', ')}\nMira la cabecera de este script para el uso.`);
  process.exit(1);
}

const file = path.join(__dirname, '..', 'data', 'products.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data.categorias.some(c => c.id === args.categoria)) {
  console.error(`❌ Categoría "${args.categoria}" no existe. Válidas: ${data.categorias.map(c => c.id).join(', ')}`);
  process.exit(1);
}

const id = args.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
if (data.productos.some(p => p.id === id)) {
  console.error(`❌ Ya existe un producto con id "${id}".`);
  process.exit(1);
}

data.productos.push({
  id,
  categoria: args.categoria,
  titulo: args.titulo,
  precio: args.precio,
  imagen: args.imagen || '',
  urlProducto: args.url,
  affiliateUrl: args.afiliado || '',
  veredicto: args.veredicto,
  pros: args.pros ? args.pros.split('|') : [],
  contras: args.contras ? args.contras.split('|') : [],
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log(`✅ Producto "${args.titulo}" añadido (id: ${id})${args.afiliado ? '' : ' — ⚠️ SIN enlace de afiliado: no se publicará hasta que lo añadas'}.`);
console.log('Regenera el sitio con: node scripts/build.js');
