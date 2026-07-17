#!/usr/bin/env node
/**
 * make-video.js v2 — MOTOR DE VÍDEO PUBLICITARIO (nivel anuncio profesional)
 *
 * Estructura narrativa Problema → Agitación → Solución (regla de Daniel):
 *   1. DOLOR      — el problema del oficio, imagen de ambiente, tono frío
 *   2. AGITACIÓN  — por qué duele de verdad
 *   3. SOLUCIÓN   — FOTO REAL del producto, tono cálido
 *   4. PRUEBA     — valoración + ventas + el pro honesto
 *   5. CIERRE     — precio + llamada a la acción
 *
 * Técnica: voz neuronal (msedge-tts, es-ES-AlvaroNeural), foto real del producto
 * descargada con Referer, movimiento Ken Burns, etalonado por tono (frío/cálido),
 * colchón musical generado con ffmpeg bajo la voz. Vertical 1080×1920.
 *
 * Uso:
 *   node scripts/make-video.js                 → producto rotativo del día
 *   node scripts/make-video.js <id-producto>   → producto concreto
 *   node scripts/make-video.js --todos         → uno por cada producto publicable
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'social', 'video');
const W = 1080, H = 1920, FPS = 30;
const VOZ = 'es-ES-AlvaroNeural';
const FONT = "C\\:/Windows/Fonts/arialbd.ttf";

const productos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.json'), 'utf8'));

// ── Descarga de la foto REAL del producto (necesita Referer o AliExpress corta) ──
function descargar(url, destino) {
  if (fs.existsSync(destino)) return Promise.resolve(destino);
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
        'Referer': 'https://www.aliexpress.com/',
      },
      timeout: 30000,
    }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const f = fs.createWriteStream(destino);
      res.pipe(f);
      f.on('finish', () => f.close(() => resolve(destino)));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
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

// ── Guion por categoría: dolor y agitación específicos del oficio ──
const GUIONES = {
  medicion: {
    dolor: { vo: 'Mides dos veces, cortas una... y aun así la pieza no encaja.', titular: '¿Mides bien...\ny no encaja?' },
    agita: { vo: 'No es tu ojo. Es que tu herramienta de medir te está mintiendo, y cada pieza torcida es madera y horas a la basura.', titular: 'Tu medidor\nte miente' },
  },
  corte: {
    dolor: { vo: '¿El corte te sale torcido, astillado, o a medio camino se atasca?', titular: '¿Tu corte\nsale así?' },
    agita: { vo: 'No es tu pulso. Es el filo. Con mala herramienta, ni treinta años de oficio te salvan la pieza.', titular: 'No es tu pulso.\nEs el filo.' },
  },
  sujecion: {
    dolor: { vo: '¿La pieza se te mueve justo cuando no debe?', titular: 'La pieza\nse mueve' },
    agita: { vo: 'Un milímetro de juego en el apriete y el encaje ya no cierra. Ahí muere el trabajo fino.', titular: 'Un milímetro\nlo arruina todo' },
  },
  electricas: {
    dolor: { vo: '¿La broca barata te ha partido una pieza a mitad de trabajo?', titular: 'La broca barata\nte parte la pieza' },
    agita: { vo: 'Lo barato sale caro cuando quema el material, baila en el agujero, o se rompe dentro.', titular: 'Lo barato\nsale caro' },
  },
};
const GUION_DEFECTO = {
  dolor: { vo: '¿Cuántas piezas has tirado por culpa de una mala herramienta?', titular: '¿Cuánta madera\nhas tirado?' },
  agita: { vo: 'El material no perdona. O la herramienta responde, o el trabajo lo pagas tú.', titular: 'El material\nno perdona' },
};

function nombreCorto(titulo) {
  const corte = titulo.split(/[,،]/)[0].trim();
  const palabras = corte.split(' ').slice(0, 6).join(' ');
  return palabras.length > 40 ? palabras.split(' ').slice(0, 4).join(' ') : palabras;
}
function partir(s, max = 18) {
  if (s.includes('\n')) return s;
  const ps = s.split(' '); let a = '', b = '';
  for (const p of ps) ((a + ' ' + p).trim().length <= max || !b && !a ? a = (a + ' ' + p).trim() : b = (b + ' ' + p).trim());
  return b ? a + '\n' + b : a;
}

async function tts(texto, dir, nombre) {
  const d = path.join(dir, nombre);
  fs.mkdirSync(d, { recursive: true });
  const t = new MsEdgeTTS();
  await t.setMetadata(VOZ, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await t.toFile(d, texto);
  return audioFilePath;
}
function durAudio(f) {
  let out = '';
  try { out = execSync(`ffmpeg -i "${f}" 2>&1`, { encoding: 'utf8' }).toString(); }
  catch (e) { out = ((e.stdout || '') + (e.stderr || '')).toString(); }
  const m = out.match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : 3;
}

// ── Construye el vídeo de un producto ──
async function videoDe(p) {
  const dir = path.join(OUT, p.id);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n🎬 ${p.titulo.slice(0, 70)}…`);

  // Foto REAL del producto + ambiente IA para las escenas de dolor
  const fotoReal = p.imagen ? await descargar(p.imagen, path.join(dir, 'producto.jpg')) : null;
  const amb = fotoAmbiente(
    'cinematic photo, moody rustic woodworking workshop, dramatic side light, ' +
    'wood shavings, worn workbench, shallow depth of field, dark tones, no text, no people faces',
    path.join(dir, 'ambiente.png'));
  if (!fotoReal) console.log('   ⚠️ sin foto real del producto — uso ambiente IA en todas las escenas');

  const g = GUIONES[p.categoria] || GUION_DEFECTO;
  const corto = nombreCorto(p.titulo);
  const pro = (p.pros && p.pros.find(x => !/ventas|Valoración/i.test(x))) || (p.pros && p.pros[0]) || '';
  const precioVo = p.precio.replace('€', 'euros').replace('.', ' con ');

  const escenas = [
    { img: amb, tono: 'dolor', zoom: 'in', kicker: '', titular: g.dolor.titular, vo: g.dolor.vo },
    { img: amb, tono: 'dolor', zoom: 'out', kicker: '', titular: g.agita.titular, vo: g.agita.vo },
    { img: fotoReal || amb, tono: 'sol', zoom: 'in', kicker: 'LA SOLUCIÓN', titular: partir(corto), vo: `La solución: ${corto}. Probado por gente del oficio, no por influencers.` },
    { img: fotoReal || amb, tono: 'sol', zoom: 'out', kicker: `⭐ ${p.valoracion} · ${p.ventas} ventas recientes`, titular: partir('Valorado por quien lo usa', 16), vo: `${p.valoracion} estrellas y ${p.ventas} compras solo este mes. ${pro ? pro + '.' : ''}` },
    { img: fotoReal || amb, tono: 'sol', zoom: 'in', kicker: 'ENLACE EN LA BIO', titular: `Por ${p.precio}\nen la tienda`, vo: `Por ${precioVo}. Tienes el enlace en la bio, en El Rincón del Taller. Si se agota, es lo que hay.` },
  ];

  const tmp = path.join(dir, 'tmp'); fs.mkdirSync(tmp, { recursive: true });
  const clips = [];

  for (let i = 0; i < escenas.length; i++) {
    const e = escenas[i];
    const voMp3 = await tts(e.vo, tmp, `vo${i}`);
    const dur = Math.max(2.8, durAudio(voMp3) + 0.6);
    const frames = Math.round(dur * FPS);
    const acento = e.tono === 'dolor' ? '0xcc3333' : '0xc8641e';
    const grad = e.tono === 'dolor' ? 0.85 : 0.55;

    const z = e.zoom === 'in'
      ? `zoompan=z='min(zoom+0.0009,1.14)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`
      : `zoompan=z='if(eq(on,0),1.14,max(1.001,zoom-0.0009))':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`;

    const esc = s => s.replace(/'/g, '’').replace(/:/g, '\\:').replace(/,/g, '\\,').replace(/%/g, '\\%');
    const lineas = e.titular.split('\n');
    const drawTitular = lineas.map((ln, k) =>
      `drawtext=fontfile='${FONT}':text='${esc(ln)}':fontcolor=white:fontsize=${lineas.some(l => l.length > 14) ? 78 : 92}:x=(w-tw)/2:y=h-560+${k * 100}:shadowcolor=black@0.7:shadowx=4:shadowy=4`
    ).join(',');
    const drawKicker = e.kicker
      ? `,drawtext=fontfile='${FONT}':text='${esc(e.kicker)}':fontcolor=white:fontsize=44:x=(w-tw)/2:y=h-664:box=1:boxcolor=${acento}@0.95:boxborderw=18`
      : '';

    const vf = [
      `scale=${W}:${H}:force_original_aspect_ratio=${e.img === fotoReal ? 'decrease,pad=' + W + ':' + H + ':(ow-iw)/2:(oh-ih)/2:color=0x15100d' : 'increase'}`,
      e.img === fotoReal ? null : `crop=${W}:${H}`,
      z,
      `eq=brightness=-0.05:saturation=${e.tono === 'dolor' ? 0.8 : 1.12}`,
      `drawbox=x=0:y=ih-720:w=iw:h=720:color=black@${grad}:t=fill`,
      drawTitular + drawKicker,
      `format=yuv420p`,
    ].filter(Boolean).join(',');

    const out = path.join(tmp, `c${i}.mp4`);
    execSync(`ffmpeg -y -loop 1 -i "${e.img}" -i "${voMp3}" -filter_complex "[0:v]${vf}[v]" -map "[v]" -map 1:a -t ${dur.toFixed(2)} -r ${FPS} -c:v libx264 -preset medium -crf 20 -c:a aac -ar 44100 "${out}"`, { stdio: 'ignore' });
    clips.push(out);
    console.log(`   escena ${i + 1}/5 (${e.tono}, ${dur.toFixed(1)}s) ✓`);
  }

  // Concatenar + colchón musical grave generado (drone ambiental a -21dB bajo la voz)
  const lista = path.join(tmp, 'concat.txt');
  fs.writeFileSync(lista, clips.map(c => `file '${c.replace(/\\/g, '/')}'`).join('\n'));
  const sinMusica = path.join(tmp, 'sin-musica.mp4');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${lista}" -c:v libx264 -preset medium -crf 20 -c:a aac -movflags +faststart "${sinMusica}"`, { stdio: 'ignore' });

  const salida = path.join(dir, `${p.id}.mp4`);
  execSync(`ffmpeg -y -i "${sinMusica}" -filter_complex ` +
    `"aevalsrc='0.28*sin(2*PI*55*t)+0.2*sin(2*PI*82.4*t)+0.12*sin(2*PI*110*t)*sin(2*PI*0.25*t)':s=44100,` +
    `lowpass=f=300,volume=0.09,afade=t=in:d=1.5[mus];` +
    `[0:a][mus]amix=inputs=2:duration=first:dropout_transition=2[a]" ` +
    `-map 0:v -map "[a]" -c:v copy -c:a aac -movflags +faststart "${salida}"`, { stdio: 'ignore' });

  const mb = (fs.statSync(salida).size / 1048576).toFixed(1);
  const seg = durAudio(salida).toFixed(0);
  console.log(`   ✅ ${salida}  (${seg}s, ${mb} MB, voz ${VOZ})`);
  return salida;
}

// ── Main ──
(async () => {
  const publicables = productos.productos.filter(p => p.affiliateUrl || process.env.BUILD_PREVIEW);
  if (!publicables.length) {
    console.log('\n⚠️  No hay productos publicables (ninguno tiene affiliateUrl).');
    process.exit(0);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const arg = process.argv[2];
  let objetivo;
  if (arg === '--todos') objetivo = publicables;
  else if (arg) objetivo = publicables.filter(p => p.id === arg);
  else objetivo = [publicables[new Date().getDate() % publicables.length]];
  if (!objetivo.length) { console.log('Producto no encontrado'); process.exit(1); }
  for (const p of objetivo) await videoDe(p);
  console.log(`\n🎬 ${objetivo.length} vídeo(s) en social/video/\n`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
