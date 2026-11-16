// Plantillas HTML de las páginas que se publican en GitHub Pages (carpeta docs/).
import {
  escaparHTML as e, fechaCorta, fechaDeNoticia, fechaLarga, horaLocal,
} from '../lib/utilidades.js';

// Íconos estilo Lucide (trazo de 2px), como los que usa shadcn/ui.
const icono = (contenido, tam = 16) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenido}</svg>`;

const ICONOS = {
  periodico: (t) => icono('<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>', t),
  calendario: (t) => icono('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>', t),
  buscar: (t) => icono('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', t),
  externo: (t) => icono('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>', t),
  izquierda: (t) => icono('<path d="m15 18-6-6 6-6"/>', t),
  derecha: (t) => icono('<path d="m9 18 6-6-6-6"/>', t),
  alerta: (t) => icono('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>', t),
};

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1e3a8a"/><path d="M9 23h14M9 18h14M9 9h6v5H9z" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
)}`;

function documento({ titulo, descripcion, raiz, contenido, ajustes }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titulo)}</title>
<meta name="description" content="${e(descripcion)}">
<meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b1120" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${raiz}estilos.css">
</head>
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="barra">
  <div class="contenedor barra-interior">
    <a class="marca" href="${raiz}index.html">
      <span class="logo">${ICONOS.periodico(18)}</span>
      <span><strong>${e(ajustes.tituloSitio)}</strong><small>${e(ajustes.subtitulo)}</small></span>
    </a>
    <a class="btn btn-fantasma" href="${raiz}archivo.html" aria-label="Archivo de reportes">${ICONOS.calendario(16)}<span class="solo-escritorio">Archivo</span></a>
  </div>
</header>
<main id="contenido" class="contenedor">
${contenido}
</main>
<footer class="pie">
  <div class="contenedor">
    <p>Generado automáticamente con GitHub Actions a partir de los feeds RSS públicos de cada medio.</p>
    <p>Los titulares, resúmenes y enlaces pertenecen a sus autores. Contrasta siempre varias fuentes.</p>
  </div>
</footer>
<script src="${raiz}app.js" defer></script>
</body>
</html>
`;
}

function contarPor(noticias, campo) {
  const conteo = {};
  for (const n of noticias) conteo[n[campo]] = (conteo[n[campo]] ?? 0) + 1;
  return conteo;
}

/**
 * Página de un día.
 * opciones: { dia, noticias, ajustes, fuentes, estadoFuentes, anterior, siguiente,
 *             esPortada, esHoy, actualizado, diasRecientes }
 */
export function paginaDia(o) {
  const { dia, noticias, ajustes, fuentes } = o;
  const zona = ajustes.zonaHoraria;
  const raiz = o.esPortada ? '' : '../';
  const rutaDia = (d) => (o.esPortada ? `dia/${d}.html` : `${d}.html`);
  const secciones = ajustes.secciones;
  const nombreSeccion = Object.fromEntries(secciones.map((s) => [s.id, s.nombre]));
  const porSeccion = contarPor(noticias, 'seccion');
  const porFuente = contarPor(noticias, 'fuente');
  const fuentesDelDia = fuentes.filter((f) => porFuente[f.id] || (o.esHoy && f.activa !== false));
  const conError = o.esHoy ? fuentes.filter((f) => f.activa !== false && o.estadoFuentes[f.id]?.error) : [];
  const zonaLegible = ajustes.nombreZonaHoraria ?? zona.split('/').pop().replace(/_/g, ' ');

  const badges = [
    '<span class="badge badge-contorno">Reporte diario</span>',
    o.esHoy ? '<span class="badge badge-ambar"><span class="pulso"></span>En curso</span>' : '',
  ].join('');

  const navegacion = `
    <nav class="navegacion-dias" aria-label="Navegar entre días">
      ${o.anterior
        ? `<a class="btn" href="${rutaDia(o.anterior)}" rel="prev">${ICONOS.izquierda(16)}<span>${e(fechaCorta(o.anterior))}</span></a>`
        : `<span class="btn" aria-disabled="true">${ICONOS.izquierda(16)}<span>Anterior</span></span>`}
      ${o.siguiente
        ? `<a class="btn" href="${rutaDia(o.siguiente)}" rel="next"><span>${e(fechaCorta(o.siguiente))}</span>${ICONOS.derecha(16)}</a>`
        : `<span class="btn" aria-disabled="true"><span>Siguiente</span>${ICONOS.derecha(16)}</span>`}
    </nav>`;

  const subtitulo = [
    `${noticias.length.toLocaleString('es-CO')} noticias de ${Object.keys(porFuente).length} fuentes`,
    `hora de ${zonaLegible}`,
    o.actualizado ? `actualizado a las ${horaLocal(o.actualizado, zona)}` : '',
  ].filter(Boolean).join(' · ');

  const alerta = conError.length
    ? `<div class="alerta" role="status">${ICONOS.alerta(16)}<div><strong>${conError.length === 1 ? '1 fuente no respondió' : `${conError.length} fuentes no respondieron`} en la última revisión</strong>${conError.map((f) => e(f.nombre)).join(', ')}. Se volverá a intentar en la próxima ejecución.</div></div>`
    : '';

  const estadisticas = `
    <section class="estadisticas" aria-label="Resumen del día">
      <div class="card estadistica"><div class="etiqueta">Total</div><div class="numero">${noticias.length.toLocaleString('es-CO')}</div></div>
      ${secciones.map((s) => `
      <div class="card estadistica"><div class="etiqueta"><span class="punto punto-${e(s.id)}"></span>${e(s.nombre)}</div><div class="numero">${(porSeccion[s.id] ?? 0).toLocaleString('es-CO')}</div></div>`).join('')}
    </section>`;

  const pestanas = [{ id: 'todas', nombre: 'Todas', total: noticias.length }, ...secciones.map((s) => ({ ...s, total: porSeccion[s.id] ?? 0 }))]
    .map((s, i) => `<button class="tab" role="tab" type="button" data-seccion="${e(s.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${e(s.nombre)}<span class="conteo">${s.total}</span></button>`)
    .join('');

  const opcionesFuente = fuentes
    .filter((f) => porFuente[f.id])
    .map((f) => `<option value="${e(f.id)}">${e(f.nombre)} (${porFuente[f.id]})</option>`)
    .join('');

  const items = noticias.map((n) => {
    const fecha = fechaDeNoticia(n);
    return `
      <li class="noticia" data-seccion="${e(n.seccion)}" data-fuente="${e(n.fuente)}" data-idioma="${e(n.idioma)}">
        <time class="hora" datetime="${fecha.toISOString()}">${horaLocal(fecha, zona)}</time>
        <div>
          <h3 class="titulo"><a href="${e(n.enlace)}" target="_blank" rel="noopener noreferrer">${e(n.titulo)}${ICONOS.externo(13)}</a></h3>
          ${ajustes.mostrarResumen !== false && n.resumen ? `<p class="resumen">${e(n.resumen)}</p>` : ''}
          <div class="meta">
            <span class="badge badge-secundario">${e(n.fuenteNombre)}</span>
            <span class="seccion"><span class="punto punto-${e(n.seccion)}"></span>${e(nombreSeccion[n.seccion] ?? n.seccion)}</span>
            <span class="idioma" title="Idioma de la fuente">${e(n.idioma.toUpperCase())}</span>
          </div>
        </div>
      </li>`;
  }).join('');

  const listaFuentes = fuentesDelDia.map((f) => {
    const estado = o.estadoFuentes[f.id];
    const claseEstado = !o.esHoy ? '' : estado?.error ? 'estado-error' : estado ? 'estado-ok' : '';
    const detalle = o.esHoy && estado?.error
      ? `<small class="error">Sin respuesta: ${e(estado.error)}</small>`
      : `<small>${e(f.tipo)} · ${e(f.pais)}</small>`;
    const punto = o.esHoy ? `<span class="estado ${claseEstado}"></span>` : '';
    return `<li>${punto}<div><a href="${e(f.sitio)}" target="_blank" rel="noopener noreferrer">${e(f.nombre)}</a>${detalle}</div><span class="conteo">${porFuente[f.id] ?? 0}</span></li>`;
  }).join('');

  const diasRecientes = o.diasRecientes?.length
    ? `
      <div class="card">
        <div class="card-encabezado"><h2>Días recientes</h2></div>
        <div class="card-contenido">
          <ul class="lista-dias">
            ${o.diasRecientes.map((d) => `<li><a href="${rutaDia(d.dia)}"${d.dia === dia ? ' aria-current="page"' : ''}><span>${e(fechaLarga(d.dia))}</span><span class="conteo">${d.total}</span></a></li>`).join('')}
          </ul>
        </div>
      </div>`
    : '';

  const contenido = `
  <section class="encabezado">
    <div>
      <div class="fila-badges">${badges}</div>
      <h1 class="serif">${e(fechaLarga(dia))}</h1>
      <p>${e(subtitulo)}</p>
    </div>
    ${navegacion}
  </section>
  ${alerta}
  ${estadisticas}
  <div class="diseno">
    <section aria-label="Noticias">
      <div class="card herramientas">
        <div class="tabs" role="tablist" aria-label="Secciones">${pestanas}</div>
        <div class="filtros">
          <label class="campo">
            <span class="sr-only">Buscar en titulares y resúmenes</span>
            ${ICONOS.buscar(16)}
            <input class="input" type="search" placeholder="Buscar en titulares…" autocomplete="off" data-busqueda>
            <kbd class="kbd">/</kbd>
          </label>
          <label><span class="sr-only">Filtrar por fuente</span><select class="select" data-filtro-fuente><option value="">Todas las fuentes</option>${opcionesFuente}</select></label>
          <label><span class="sr-only">Filtrar por idioma</span><select class="select" data-filtro-idioma><option value="">Ambos idiomas</option><option value="es">Español</option><option value="en">Inglés</option></select></label>
        </div>
      </div>
      <p class="resultado" aria-live="polite"><span><span data-visibles>${noticias.length}</span> noticias</span><span>Más recientes primero</span></p>
      <ol class="card lista" data-lista${noticias.length ? '' : ' hidden'}>${items}
      </ol>
      <div class="card vacio" data-vacio${noticias.length ? ' hidden' : ''}>
        <strong>${noticias.length ? 'Sin resultados' : 'Todavía no hay noticias para este día'}</strong>
        ${noticias.length ? 'Prueba con otra palabra o quita algún filtro.' : 'Aparecerán aquí en la próxima revisión automática.'}
      </div>
    </section>
    <aside class="columna-lateral">
      <div class="card">
        <div class="card-encabezado"><h2>Fuentes</h2><p>Medios con trayectoria editorial verificable, de distintos países y perspectivas.</p></div>
        <div class="card-contenido"><ul class="lista-fuentes${o.esHoy ? '' : ' sin-estado'}">${listaFuentes}</ul></div>
      </div>
      ${diasRecientes}
      <div class="card nota"><strong>Cómo se arma este reporte.</strong> Cada pocas horas se leen los feeds RSS oficiales de cada medio. Una noticia va a <em>${e(nombreSeccion[secciones[0].id])}</em> si su titular o resumen menciona alguno de los términos configurados; si no, queda en la sección habitual de su fuente.</div>
    </aside>
  </div>`;

  return documento({
    titulo: `${fechaLarga(dia)} · ${ajustes.tituloSitio}`,
    descripcion: `Reporte de noticias del ${fechaLarga(dia)}: ${noticias.length} noticias con enlaces directos a cada medio.`,
    raiz,
    contenido,
    ajustes,
  });
}

/** Página con todos los días disponibles, agrupados por mes. */
export function paginaArchivo({ resumenDias, ajustes }) {
  const secciones = ajustes.secciones;
  const meses = new Map();
  for (const d of [...resumenDias].reverse()) {
    const mes = d.dia.slice(0, 7);
    if (!meses.has(mes)) meses.set(mes, []);
    meses.get(mes).push(d);
  }
  const nombreMes = (mes) => {
    const texto = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'long', year: 'numeric' })
      .format(new Date(`${mes}-15T12:00:00Z`));
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  };

  const bloques = [...meses].map(([mes, dias]) => `
    <section class="card">
      <div class="card-encabezado"><h2>${e(nombreMes(mes))}</h2></div>
      <table class="tabla">
        <thead><tr><th>Día</th>${secciones.map((s) => `<th class="num ocultar-movil">${e(s.nombre)}</th>`).join('')}<th class="num">Total</th></tr></thead>
        <tbody>
          ${dias.map((d) => `<tr><td><a href="dia/${d.dia}.html">${e(fechaLarga(d.dia))}</a></td>${secciones.map((s) => `<td class="num muted ocultar-movil">${d.porSeccion[s.id] ?? 0}</td>`).join('')}<td class="num">${d.total}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>`).join('');

  const contenido = `
  <section class="encabezado">
    <div>
      <div class="fila-badges"><span class="badge badge-contorno">Archivo</span></div>
      <h1 class="serif">Todos los reportes</h1>
      <p>${resumenDias.length} ${resumenDias.length === 1 ? 'día' : 'días'} registrados · también disponibles en Markdown en la carpeta <code>reportes/</code> del repositorio</p>
    </div>
  </section>
  <div class="archivo">${bloques || '<div class="card vacio"><strong>Aún no hay reportes</strong>Se crearán después de la primera revisión.</div>'}</div>`;

  return documento({
    titulo: `Archivo · ${ajustes.tituloSitio}`,
    descripcion: 'Archivo de reportes diarios de noticias.',
    raiz: '',
    contenido,
    ajustes,
  });
}
