// Paso 3 (opcional): envía una vez al día, por Telegram, el resumen del día anterior.
// Requiere las variables TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID (secretos del repositorio).
// Uso: node src/notificar.js            → envía solo si ya pasó la hora configurada y no se ha enviado hoy
//      node src/notificar.js --forzar   → envía ahora el resumen de ayer (para probar)
import {
  archivoDia, cargarConfiguracion, claveDia, escribirJSON, fechaLarga, horaNumerica,
  leerJSON, ruta, sumarDias,
} from './lib/utilidades.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!token || !chatId) {
  console.log('Aviso por Telegram no configurado: se omite (es opcional).');
  process.exit(0);
}

const { ajustes } = await cargarConfiguracion();
const zona = ajustes.zonaHoraria;
const ahora = new Date();
const hoy = claveDia(ahora, zona);
const forzar = process.argv.includes('--forzar');

const rutaAvisos = ruta('data', 'avisos.json');
const avisos = await leerJSON(rutaAvisos, {});
if (!forzar && (horaNumerica(ahora, zona) < (ajustes.horaAvisoDiario ?? 6) || avisos.ultimoAviso === hoy)) {
  console.log('Todavía no toca enviar el aviso diario.');
  process.exit(0);
}

const dia = sumarDias(hoy, -1);
const noticias = await leerJSON(archivoDia(dia), []);
const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Toma titulares alternando entre medios para que no salgan todos de la misma fuente.
function variados(lista, maximo) {
  const porFuente = new Map();
  for (const n of lista) {
    if (!porFuente.has(n.fuente)) porFuente.set(n.fuente, []);
    porFuente.get(n.fuente).push(n);
  }
  const colas = [...porFuente.values()];
  const elegidos = [];
  while (elegidos.length < maximo && colas.some((c) => c.length)) {
    for (const cola of colas) if (cola.length && elegidos.length < maximo) elegidos.push(cola.shift());
  }
  return elegidos;
}

const principal = ajustes.secciones[0];
const conteos = ajustes.secciones
  .map((s) => `${s.nombre}: ${noticias.filter((n) => n.seccion === s.id).length}`)
  .join(' · ');
const titulares = variados(noticias.filter((n) => n.seccion === principal.id), 10)
  .map((n) => `• <a href="${escapar(n.enlace)}">${escapar(n.titulo)}</a> <i>(${escapar(n.fuenteNombre)})</i>`);

const base = ajustes.urlSitio ? ajustes.urlSitio.replace(/\/?$/, '/') : '';
const armar = (lineas) => [
  `<b>📰 Reporte del ${escapar(fechaLarga(dia).toLowerCase())}</b>`,
  `${noticias.length} noticias · ${conteos}`,
  '',
  lineas.length ? `<b>${escapar(principal.nombre)}</b>\n${lineas.join('\n')}` : '<i>Sin noticias en la sección principal.</i>',
  base ? `\n<a href="${escapar(`${base}dia/${dia}.html`)}">Ver el reporte completo →</a>` : '',
].join('\n');

// Telegram admite hasta 4096 caracteres por mensaje: se quitan titulares si hace falta.
let mensaje = armar(titulares);
while (mensaje.length > 4000 && titulares.length > 1) {
  titulares.pop();
  mensaje = armar(titulares);
}

const respuesta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text: mensaje, parse_mode: 'HTML', disable_web_page_preview: true }),
});
const datos = await respuesta.json().catch(() => ({}));
if (!respuesta.ok || !datos.ok) {
  console.error(`Telegram respondió con error: ${datos.description ?? respuesta.status}`);
  process.exit(1);
}

await escribirJSON(rutaAvisos, { ...avisos, ultimoAviso: hoy, diaEnviado: dia });
console.log(`Aviso enviado por Telegram con el reporte del ${dia}.`);
