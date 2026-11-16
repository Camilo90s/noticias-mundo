// Paso 2: genera los reportes diarios en Markdown (reportes/) y la página web (docs/).
// Uso: node src/reporte.js          → regenera los últimos días (ajustes.diasARegenerar)
//      node src/reporte.js --todo   → regenera todos los días (útil si cambias el diseño)
import { copyFile, mkdir } from 'node:fs/promises';
import { paginaArchivo, paginaDia } from './plantillas/paginas.js';
import {
  archivoDia, cargarConfiguracion, claveDia, diasDisponibles, escribirJSON, escribirTexto,
  fechaDeNoticia, fechaLarga, horaLocal, leerJSON, ruta,
} from './lib/utilidades.js';

const { ajustes, fuentes } = await cargarConfiguracion();
const zona = ajustes.zonaHoraria;
const ahora = new Date();
const hoy = claveDia(ahora, zona);
const regenerarTodo = process.argv.includes('--todo');

const estadoFuentes = await leerJSON(ruta('data', 'estado-fuentes.json'), {});
const ultimaEjecucion = await leerJSON(ruta('data', 'ultima-ejecucion.json'), null);
const actualizado = ultimaEjecucion ? new Date(ultimaEjecucion.fecha) : null;

const dias = await diasDisponibles();
const aGenerar = new Set(regenerarTodo ? dias : dias.slice(-(ajustes.diasARegenerar ?? 3)));

// Índice liviano con los conteos de cada día (para el archivo y la portada).
const rutaResumen = ruta('data', 'resumen-dias.json');
const resumenPrevio = Object.fromEntries((await leerJSON(rutaResumen, [])).map((d) => [d.dia, d]));

async function cargarDia(dia) {
  const noticias = await leerJSON(archivoDia(dia), []);
  return noticias.sort((a, b) => fechaDeNoticia(b) - fechaDeNoticia(a));
}

function resumir(dia, noticias) {
  const porSeccion = {};
  for (const n of noticias) porSeccion[n.seccion] = (porSeccion[n.seccion] ?? 0) + 1;
  return { dia, total: noticias.length, porSeccion };
}

function markdownDelDia(dia, noticias, esHoy) {
  const fuentesUsadas = new Set(noticias.map((n) => n.fuente)).size;
  const lineas = [
    `# Reporte de noticias — ${fechaLarga(dia)}${esHoy ? ' (en curso)' : ''}`,
    '',
    `${noticias.length} noticias de ${fuentesUsadas} fuentes. Horas en ${ajustes.nombreZonaHoraria ?? zona}.${actualizado ? ` Última revisión: ${horaLocal(actualizado, zona)}.` : ''}`,
    '',
    '| Sección | Noticias |',
    '|---|---:|',
    ...ajustes.secciones.map((s) => `| ${s.nombre} | ${noticias.filter((n) => n.seccion === s.id).length} |`),
    '',
  ];
  for (const seccion of ajustes.secciones) {
    const deSeccion = noticias.filter((n) => n.seccion === seccion.id);
    lineas.push(`## ${seccion.nombre} (${deSeccion.length})`, '');
    if (!deSeccion.length) lineas.push('_Sin noticias._');
    for (const n of deSeccion) {
      const titulo = n.titulo.replace(/([[\]])/g, '\\$1');
      lineas.push(`- **${horaLocal(fechaDeNoticia(n), zona)}** · [${titulo}](${n.enlace}) — _${n.fuenteNombre}_`);
    }
    lineas.push('');
  }
  if (esHoy) {
    const conError = fuentes.filter((f) => f.activa !== false && estadoFuentes[f.id]?.error);
    if (conError.length) {
      lineas.push('## Fuentes que no respondieron en la última revisión', '');
      for (const f of conError) lineas.push(`- ${f.nombre}: ${estadoFuentes[f.id].error}`);
      lineas.push('');
    }
  }
  return lineas.join('\n');
}

// Archivos estáticos compartidos por todas las páginas.
await mkdir(ruta('docs', 'dia'), { recursive: true });
await copyFile(ruta('src', 'plantillas', 'estilos.css'), ruta('docs', 'estilos.css'));
await copyFile(ruta('src', 'plantillas', 'app.js'), ruta('docs', 'app.js'));
await escribirTexto(ruta('docs', '.nojekyll'), '');

const resumenDias = [];
let portada = null;

for (const [i, dia] of dias.entries()) {
  if (!aGenerar.has(dia) && resumenPrevio[dia]) {
    resumenDias.push(resumenPrevio[dia]);
    continue;
  }
  const noticias = await cargarDia(dia);
  resumenDias.push(resumir(dia, noticias));
  if (!aGenerar.has(dia)) continue;

  const esHoy = dia === hoy;
  const comun = {
    dia, noticias, ajustes, fuentes, estadoFuentes, esHoy,
    anterior: dias[i - 1] ?? null,
    siguiente: dias[i + 1] ?? null,
    actualizado: esHoy ? actualizado : null,
  };
  await escribirTexto(ruta('reportes', dia.slice(0, 7), `${dia}.md`), markdownDelDia(dia, noticias, esHoy));
  await escribirTexto(ruta('docs', 'dia', `${dia}.html`), paginaDia(comun));
  if (i === dias.length - 1) portada = comun;
}

// Portada (docs/index.html): el día más reciente + accesos a los días anteriores.
const diasRecientes = resumenDias.slice(-8).reverse();
await escribirTexto(
  ruta('docs', 'index.html'),
  paginaDia(portada
    ? { ...portada, esPortada: true, diasRecientes }
    : { dia: hoy, noticias: [], ajustes, fuentes, estadoFuentes, esHoy: true, esPortada: true, actualizado, diasRecientes }),
);
await escribirTexto(ruta('docs', 'archivo.html'), paginaArchivo({ resumenDias, ajustes }));
await escribirJSON(rutaResumen, resumenDias);

console.log(`Reportes generados: ${aGenerar.size} día(s) · portada: ${portada?.dia ?? 'sin datos'}`);
