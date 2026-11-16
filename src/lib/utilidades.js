// Funciones compartidas: rutas, archivos, fechas, texto y enlaces.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ruta = (...partes) => join(RAIZ, ...partes);

// ---------- Archivos ----------

export async function leerJSON(archivo, porDefecto) {
  try {
    return JSON.parse(await readFile(archivo, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && porDefecto !== undefined) return porDefecto;
    throw error;
  }
}

export async function escribirTexto(archivo, texto) {
  await mkdir(dirname(archivo), { recursive: true });
  await writeFile(archivo, texto);
}

export const escribirJSON = (archivo, datos) =>
  escribirTexto(archivo, JSON.stringify(datos, null, 2) + '\n');

export async function cargarConfiguracion() {
  const ajustes = await leerJSON(ruta('config', 'ajustes.json'));
  const fuentes = await leerJSON(ruta('config', 'fuentes.json'));
  return { ajustes, fuentes };
}

// Las noticias se guardan por día: data/noticias/2026-11/2026-11-16.json
export const archivoDia = (dia) => ruta('data', 'noticias', dia.slice(0, 7), `${dia}.json`);

export async function diasDisponibles() {
  const base = ruta('data', 'noticias');
  let meses = [];
  try {
    meses = await readdir(base);
  } catch {
    return [];
  }
  const dias = [];
  for (const mes of meses) {
    if (!/^\d{4}-\d{2}$/.test(mes)) continue;
    for (const archivo of await readdir(join(base, mes))) {
      const m = archivo.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (m) dias.push(m[1]);
    }
  }
  return dias.sort();
}

// ---------- Fechas (todo se calcula en la zona horaria configurada) ----------

export function claveDia(fecha, zona) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(fecha);
}

export function horaLocal(fecha, zona) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(fecha);
}

export function horaNumerica(fecha, zona) {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: zona, hour: '2-digit', hourCycle: 'h23',
  }).format(fecha));
}

export function fechaLarga(dia) {
  const texto = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${dia}T12:00:00Z`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function fechaCorta(dia) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${dia}T12:00:00Z`));
}

export function sumarDias(dia, n) {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + n);
  return fecha.toISOString().slice(0, 10);
}

// Fecha que se usa para ordenar y agrupar una noticia.
export const fechaDeNoticia = (n) => new Date(n.publicado ?? n.detectado);

// ---------- Texto ----------

export function normalizarTexto(texto = '') {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function limpiarEspacios(texto = '') {
  return String(texto).replace(/\s+/g, ' ').trim();
}

export function recortar(texto, maximo) {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${corte.slice(0, ultimoEspacio > maximo * 0.6 ? ultimoEspacio : maximo).trimEnd()}…`;
}

export function escaparHTML(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Enlaces ----------

// Parámetros de seguimiento que se quitan para dejar el enlace directo al artículo.
const PARAMETROS_DE_RASTREO = /^(utm_|at_|ns_|mc_)|^(emc|partner|ito|cmpid|maca|fbclid|gclid|xtor|traffic_source|ocid|smid|smtyp)$/i;

export function limpiarEnlace(enlace) {
  try {
    const url = new URL(String(enlace).trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    for (const clave of [...url.searchParams.keys()]) {
      if (PARAMETROS_DE_RASTREO.test(clave)) url.searchParams.delete(clave);
    }
    return url.toString();
  } catch {
    return null;
  }
}

// Identificador estable de una noticia: no cambia con http/https, "www." ni la barra final.
export function idDeEnlace(enlace) {
  const url = new URL(enlace);
  const clave = `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  return createHash('sha1').update(clave.toLowerCase()).digest('hex').slice(0, 12);
}

export const dominioDe = (enlace) => new URL(enlace).hostname.replace(/^www\./, '');

// ---------- Secciones ----------

// Crea una función que asigna la sección de una noticia según las palabras clave de ajustes.json.
export function crearClasificador(secciones) {
  const escapar = (palabra) =>
    normalizarTexto(palabra).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

  const reglas = secciones
    .filter((s) => s.palabrasClave)
    .map(({ id, palabrasClave: { empiezaCon = [], exactas = [] } }) => {
      const partes = [
        ...empiezaCon.map(escapar),
        ...exactas.map((p) => `${escapar(p)}(?![\\p{L}\\p{N}])`),
      ];
      return partes.length
        ? { id, regex: new RegExp(`(?<![\\p{L}\\p{N}])(?:${partes.join('|')})`, 'u') }
        : null;
    })
    .filter(Boolean);

  return (texto, seccionPorDefecto) => {
    const normalizado = normalizarTexto(texto);
    for (const regla of reglas) if (regla.regex.test(normalizado)) return regla.id;
    return seccionPorDefecto;
  };
}
