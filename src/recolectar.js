// Paso 1: revisa todas las fuentes y guarda las noticias nuevas en data/noticias/AAAA-MM/AAAA-MM-DD.json
import { leerFuente } from './lib/feeds.js';
import {
  archivoDia, cargarConfiguracion, claveDia, crearClasificador, dominioDe, escribirJSON,
  fechaDeNoticia, idDeEnlace, leerJSON, limpiarEnlace, normalizarTexto, ruta, sumarDias,
} from './lib/utilidades.js';

const { ajustes, fuentes: todasLasFuentes } = await cargarConfiguracion();
const fuentes = todasLasFuentes.filter((f) => f.activa !== false);
const zona = ajustes.zonaHoraria;
const ahora = new Date();
const hoy = claveDia(ahora, zona);
const clasificar = crearClasificador(ajustes.secciones);
const maxAntiguedadMs = (ajustes.ignorarNoticiasConMasDeHoras ?? 36) * 3_600_000;

// Carga los días recientes para no repetir noticias que ya se guardaron.
const porDia = new Map();
const diasModificados = new Set();
async function noticiasDelDia(dia) {
  if (!porDia.has(dia)) porDia.set(dia, await leerJSON(archivoDia(dia), []));
  return porDia.get(dia);
}
for (let i = -3; i <= 1; i++) await noticiasDelDia(sumarDias(hoy, i));

const idsVistos = new Set();
const titulosVistos = new Set();
const claveTitulo = (titulo, enlace) => `${dominioDe(enlace)}|${normalizarTexto(titulo)}`;
for (const lista of porDia.values()) {
  for (const n of lista) {
    idsVistos.add(n.id);
    titulosVistos.add(claveTitulo(n.titulo, n.enlace));
  }
}

console.log(`Revisando ${fuentes.length} fuentes…`);
const resultados = await Promise.allSettled(fuentes.map(leerFuente));

const rutaEstado = ruta('data', 'estado-fuentes.json');
const estadoAnterior = await leerJSON(rutaEstado, {});
const estado = {};
let totalNuevas = 0;

for (const [i, fuente] of fuentes.entries()) {
  const resultado = resultados[i];
  const previo = estadoAnterior[fuente.id] ?? {};

  if (resultado.status === 'rejected') {
    const mensaje = resultado.reason?.cause?.code ?? resultado.reason?.message ?? 'Error desconocido';
    estado[fuente.id] = {
      ...previo,
      ultimoIntento: ahora.toISOString(),
      error: mensaje,
      fallandoDesde: previo.error ? previo.fallandoDesde : ahora.toISOString(),
    };
    console.warn(`  ✗ ${fuente.nombre}: ${mensaje}`);
    continue;
  }

  let nuevas = 0;
  for (const item of resultado.value) {
    const enlace = limpiarEnlace(item.enlace);
    if (!enlace || !item.titulo) continue;

    const id = idDeEnlace(enlace);
    const tituloClave = claveTitulo(item.titulo, enlace);
    if (idsVistos.has(id) || titulosVistos.has(tituloClave)) continue;

    // Fechas futuras (relojes mal configurados) se reemplazan por la hora en que se detectó.
    const publicado = item.publicado && item.publicado - ahora < 3_600_000 ? item.publicado : null;
    if (ahora - (publicado ?? ahora) > maxAntiguedadMs) continue;

    const noticia = {
      id,
      titulo: item.titulo,
      enlace,
      resumen: item.resumen,
      fuente: fuente.id,
      fuenteNombre: fuente.nombre,
      idioma: fuente.idioma,
      seccion: clasificar(`${item.titulo} ${item.resumen}`, fuente.seccion),
      publicado: publicado?.toISOString() ?? null,
      detectado: ahora.toISOString(),
    };

    const dia = claveDia(fechaDeNoticia(noticia), zona);
    (await noticiasDelDia(dia)).push(noticia);
    diasModificados.add(dia);
    idsVistos.add(id);
    titulosVistos.add(tituloClave);
    nuevas++;
  }

  totalNuevas += nuevas;
  estado[fuente.id] = {
    ultimoIntento: ahora.toISOString(),
    ultimoExito: ahora.toISOString(),
    error: null,
    recibidas: resultado.value.length,
    nuevas,
  };
  console.log(`  ✓ ${fuente.nombre}: ${resultado.value.length} en el feed, ${nuevas} nuevas`);
}

for (const dia of diasModificados) {
  const lista = porDia.get(dia).sort((a, b) => fechaDeNoticia(b) - fechaDeNoticia(a));
  await escribirJSON(archivoDia(dia), lista);
}

const conError = fuentes.filter((f) => estado[f.id].error).length;
await escribirJSON(rutaEstado, estado);
await escribirJSON(ruta('data', 'ultima-ejecucion.json'), {
  fecha: ahora.toISOString(),
  nuevas: totalNuevas,
  fuentesRevisadas: fuentes.length,
  fuentesConError: conError,
});

console.log(`Listo: ${totalNuevas} noticias nuevas · ${fuentes.length - conError}/${fuentes.length} fuentes respondieron.`);

// Si no respondió ninguna fuente, probablemente falló la red: se marca la ejecución como fallida.
if (fuentes.length > 0 && conError === fuentes.length) process.exit(1);
