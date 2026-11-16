// Filtros del reporte: pestañas por sección, búsqueda, fuente e idioma.
// Los filtros se guardan en la URL (#seccion=israel&q=gaza) para poder compartir la vista.
(() => {
  const lista = document.querySelector('[data-lista]');
  if (!lista) return;

  const normalizar = (t) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const noticias = [...lista.querySelectorAll('.noticia')].map((el) => ({ el, texto: normalizar(el.textContent) }));
  const pestanas = [...document.querySelectorAll('[role="tab"][data-seccion]')];
  const busqueda = document.querySelector('[data-busqueda]');
  const filtroFuente = document.querySelector('[data-filtro-fuente]');
  const filtroIdioma = document.querySelector('[data-filtro-idioma]');
  const contador = document.querySelector('[data-visibles]');
  const vacio = document.querySelector('[data-vacio]');

  let seccion = 'todas';

  function aplicar() {
    const consulta = normalizar(busqueda.value.trim());
    const fuente = filtroFuente.value;
    const idioma = filtroIdioma.value;
    let visibles = 0;

    for (const { el, texto } of noticias) {
      const coincide =
        (seccion === 'todas' || el.dataset.seccion === seccion) &&
        (!fuente || el.dataset.fuente === fuente) &&
        (!idioma || el.dataset.idioma === idioma) &&
        (!consulta || texto.includes(consulta));
      el.hidden = !coincide;
      if (coincide) visibles++;
    }

    contador.textContent = visibles.toLocaleString('es-CO');
    lista.hidden = visibles === 0;
    vacio.hidden = visibles !== 0;
    guardarEnURL();
  }

  function seleccionar(pestana, enfocar = false) {
    seccion = pestana.dataset.seccion;
    for (const p of pestanas) {
      const activa = p === pestana;
      p.setAttribute('aria-selected', String(activa));
      p.tabIndex = activa ? 0 : -1;
    }
    if (enfocar) pestana.focus();
    aplicar();
  }

  function guardarEnURL() {
    const params = new URLSearchParams();
    if (seccion !== 'todas') params.set('seccion', seccion);
    if (busqueda.value.trim()) params.set('q', busqueda.value.trim());
    if (filtroFuente.value) params.set('fuente', filtroFuente.value);
    if (filtroIdioma.value) params.set('idioma', filtroIdioma.value);
    const hash = params.toString();
    history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
  }

  function leerDeURL() {
    const params = new URLSearchParams(location.hash.slice(1));
    busqueda.value = params.get('q') ?? '';
    filtroFuente.value = params.get('fuente') ?? '';
    filtroIdioma.value = params.get('idioma') ?? '';
    const pestana = pestanas.find((p) => p.dataset.seccion === params.get('seccion')) ?? pestanas[0];
    seleccionar(pestana);
  }

  pestanas.forEach((pestana, i) => {
    pestana.addEventListener('click', () => seleccionar(pestana));
    pestana.addEventListener('keydown', (e) => {
      const paso = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!paso) return;
      e.preventDefault();
      seleccionar(pestanas[(i + paso + pestanas.length) % pestanas.length], true);
    });
  });
  busqueda.addEventListener('input', aplicar);
  filtroFuente.addEventListener('change', aplicar);
  filtroIdioma.addEventListener('change', aplicar);

  // Atajo: "/" enfoca la búsqueda; Escape la limpia.
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== busqueda && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      busqueda.focus();
    }
  });
  busqueda.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && busqueda.value) {
      busqueda.value = '';
      aplicar();
    }
  });

  leerDeURL();
})();
