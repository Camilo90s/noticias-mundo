// Descarga y lectura de feeds RSS / Atom / RDF.
import Parser from 'rss-parser';
import { limpiarEspacios, recortar } from './utilidades.js';

const parser = new Parser();

const AGENTE = 'Mozilla/5.0 (compatible; MonitorNoticias/1.0; lector RSS)';
const TIEMPO_LIMITE_MS = 20_000;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Respeta la codificación declarada por el servidor o por el XML (algunos feeds no usan UTF-8).
function decodificar(bytes, tipoContenido = '') {
  const cabecera = new TextDecoder('latin1').decode(bytes.slice(0, 200));
  const charset =
    tipoContenido.match(/charset=["']?([\w-]+)/i)?.[1] ??
    cabecera.match(/encoding=["']([\w-]+)["']/i)?.[1] ??
    'utf-8';
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function descargar(url, intentos = 2) {
  let ultimoError;
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const respuesta = await fetch(url, {
        headers: {
          'User-Agent': AGENTE,
          Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      });
      if (!respuesta.ok) {
        const error = new Error(`HTTP ${respuesta.status}`);
        // 4xx (salvo 429) no se arregla reintentando: el medio bloqueó o movió el feed.
        error.reintentable = respuesta.status >= 500 || respuesta.status === 429;
        throw error;
      }
      const bytes = new Uint8Array(await respuesta.arrayBuffer());
      return decodificar(bytes, respuesta.headers.get('content-type') ?? '');
    } catch (error) {
      ultimoError = error;
      if (error.reintentable === false || intento === intentos) break;
      await esperar(2000 * intento);
    }
  }
  if (ultimoError?.name === 'TimeoutError') ultimoError.message = 'Tiempo de espera agotado';
  throw ultimoError;
}

const repararXML = (xml) =>
  xml.replace(/&(?!(?:[a-zA-Z][\w.-]*|#\d+|#x[\da-fA-F]+);)/g, '&amp;');

// Quita colas típicas que algunos medios agregan al resumen.
function limpiarResumen(texto = '') {
  return recortar(
    limpiarEspacios(texto)
      .replace(/The post .+? appeared first on .+?\.?$/i, '')
      .replace(/\s*(Continue reading|Seguir leyendo|Leer más|Read more)\.{0,3}\s*$/i, '')
      .replace(/\s*\[(…|\.\.\.)\]\s*$/, '…')
      .trim(),
    260,
  );
}

/**
 * Lee una fuente y devuelve sus noticias en un formato común:
 * { titulo, enlace, resumen, publicado (Date | null) }
 */
export async function leerFuente(fuente) {
  const xml = (await descargar(fuente.url)).trimStart();
  let feed;
  try {
    feed = await parser.parseString(xml);
  } catch (error) {
    // Muchos feeds traen "&" sin escapar dentro de los enlaces; se repara y se intenta otra vez.
    try {
      feed = await parser.parseString(repararXML(xml));
    } catch {
      throw new Error(`El feed no es XML válido (${String(error.message).split('\n')[0]})`);
    }
  }
  return (feed.items ?? []).map((item) => {
    const fecha = item.isoDate ? new Date(item.isoDate) : null;
    return {
      titulo: limpiarEspacios(item.title ?? ''),
      enlace: (item.link ?? item.guid ?? item['rdf:about'] ?? '').trim(),
      resumen: limpiarResumen(item.contentSnippet ?? item.summary ?? ''),
      publicado: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null,
    };
  });
}
