#!/usr/bin/env node
/**
 * Genera las fotos IA del pack del día.
 * Motor por defecto: Pollinations.ai (Flux) — GRATIS, sin clave, sin registro.
 * Motor alternativo: Gemini (requiere GEMINI_API_KEY con facturación activa):
 *   IMAGE_ENGINE=gemini node scripts/gen-image.js
 *
 * Sin argumentos: lee el prompt-imagen.txt del pack del día y genera
 *   foto-ia.png (1080×1080) y foto-ia-vertical.png (1080×1920).
 * Con argumentos: node scripts/gen-image.js "<prompt>" <salida.png> [ancho] [alto]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const ENGINE = process.env.IMAGE_ENGINE || 'pollinations';

function descargar(url, salida, redirLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 150000, headers: { 'User-Agent': 'tienda-taller-bot' } }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirLeft > 0) {
        res.resume();
        return resolve(descargar(res.headers.location, salida, redirLeft - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 5000) return reject(new Error('respuesta demasiado pequeña, no parece imagen'));
        fs.writeFileSync(salida, buf);
        resolve(buf.length);
      });
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}

function pollinations(prompt, salida, w, h) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`;
  return descargar(url, salida);
}

function gemini(prompt, salida) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return Promise.reject(new Error('sin GEMINI_API_KEY'));
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } });
  const modelo = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  return new Promise((resolve, reject) => {
    const req = https.request(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 120000 }, res => {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => {
          try {
            const parte = JSON.parse(buf).candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (!parte) return reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 150)}`));
            const b = Buffer.from(parte.inlineData.data, 'base64');
            fs.writeFileSync(salida, b);
            resolve(b.length);
          } catch (e) { reject(e); }
        });
      });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end(body);
  });
}

(async () => {
  let trabajos;
  if (process.argv[2]) {
    trabajos = [[process.argv[2], process.argv[3] || 'imagen.png', +process.argv[4] || 1080, +process.argv[5] || 1080]];
  } else {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'social', 'state.json'), 'utf8'));
    const dir = path.join(ROOT, state.ultimo.dir);
    const prompt = fs.readFileSync(path.join(dir, 'prompt-imagen.txt'), 'utf8').split('---')[0].trim();
    trabajos = [
      [prompt, path.join(dir, 'foto-ia.png'), 1080, 1080],
      [prompt, path.join(dir, 'foto-ia-vertical.png'), 1080, 1920],
    ];
  }
  let fallos = 0;
  for (const [prompt, salida, w, h] of trabajos) {
    try {
      const bytes = ENGINE === 'gemini' ? await gemini(prompt, salida) : await pollinations(prompt, salida, w, h);
      console.log(`✅ ${path.basename(salida)} (${w}×${h}, ${Math.round(bytes / 1024)} KB, motor ${ENGINE})`);
    } catch (e) {
      fallos++;
      console.error(`⚠️ ${path.basename(salida)}: ${e.message} — el pack sigue valiendo con las tarjetas de marca.`);
    }
  }
  process.exit(fallos === trabajos.length ? 1 : 0);
})();
