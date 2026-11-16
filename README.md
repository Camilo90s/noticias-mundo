# Monitor de noticias · Israel y el mundo

**Sitio:** https://noticias-mundo-ten.vercel.app

Revisa automáticamente, cada 2 horas y todos los días, los feeds RSS oficiales de medios reconocidos. Clasifica las noticias (con prioridad para Israel y Palestina), guarda **enlaces directos** a cada artículo y genera un **reporte diario** en dos formatos:

- **Página web** (publicada en Vercel) con pestañas por sección, buscador y filtros por fuente e idioma. Estilo shadcn/ui, con modo claro y oscuro.
- **Markdown** en `reportes/AAAA-MM/AAAA-MM-DD.md`, fácil de leer en GitHub o de copiar a otro lado.
- **Aviso por Telegram** (opcional) cada mañana con el resumen del día anterior.

Todo corre con herramientas gratuitas: **GitHub Actions** (gratis e ilimitado en repositorios públicos) para revisar las fuentes y **Vercel** (plan Hobby) para publicar la página. No necesita servidor, base de datos ni claves de API.

---

## Cómo funciona

```
cada 2 horas (GitHub Actions)
  └─ npm run recolectar → lee los feeds, quita duplicados y parámetros de rastreo, clasifica
  └─ npm run reporte    → reportes/…md + docs/ (la página web)
  └─ npm run notificar  → (opcional) una vez al día, Telegram con el resumen de ayer
  └─ commit automático  → los datos quedan guardados en el repositorio
                           └─ Vercel detecta el commit y publica la carpeta docs/
```

**Secciones**

| Sección | Qué entra |
|---|---|
| Israel y Palestina | Todo lo de los medios israelíes y cualquier noticia de otro medio cuyo titular o resumen mencione términos como Israel, Gaza, Jerusalén, Cisjordania, Knesset, Hamás, Hezbolá… (lista completa en `config/ajustes.json`) |
| Medio Oriente | El resto de lo que publican las secciones regionales (BBC, NYT, France 24, ONU) |
| Mundo | El resto de lo que publican los medios internacionales |

---

## Puesta en marcha

Este repositorio (`Camilo90s/noticias-mundo`) ya está configurado. Si lo montas de nuevo en otra cuenta:

1. **Repositorio público** en GitHub. (Privado también funciona, pero gasta de los 2.000 minutos gratis al mes; este proyecto usa unos 400.)
2. **Autor de los commits automáticos:** en `.github/workflows/monitor.yml` cambia `AUTOR_NOMBRE` y `AUTOR_EMAIL` por tu usuario y tu correo *noreply* de GitHub (*Settings → Emails*). El plan gratuito de Vercel solo despliega commits hechos por el dueño de la cuenta.
3. **Primera ejecución a mano:** pestaña *Actions → Monitor de noticias → Run workflow*. Tarda menos de un minuto y deja un commit con las primeras noticias. Si falla al hacer `git push`, ve a *Settings → Actions → General → Workflow permissions* y marca **Read and write permissions**.
4. **Vercel:** *Add New → Project →* importa el repositorio. No hay que configurar nada más: `vercel.json` le indica que publique la carpeta `docs/` sin compilar.
5. Copia la dirección que te da Vercel en `"urlSitio"` dentro de `config/ajustes.json` (sirve para el enlace del aviso de Telegram).

Desde ese momento se ejecuta solo cada 2 horas, todos los días, y Vercel publica cada actualización (unas 12 al día, lejos del límite de 100 despliegues diarios del plan gratuito).

> **Alternativa sin Vercel:** *Settings → Pages →* **Deploy from a branch**, rama **main**, carpeta **/docs**.

---

## Aviso diario por Telegram (opcional)

1. En Telegram, habla con **@BotFather**, envía `/newbot` y sigue los pasos. Te dará un **token**.
2. Escríbele cualquier mensaje a tu bot nuevo.
3. Abre en el navegador `https://api.telegram.org/botTU_TOKEN/getUpdates` y copia el número que aparece en `"chat":{"id": …}`.
4. En GitHub: *Settings → Secrets and variables → Actions → New repository secret* y crea:
   - `TELEGRAM_BOT_TOKEN` → el token
   - `TELEGRAM_CHAT_ID` → el número del chat

Cada día, en la primera ejecución después de las 6:00 a. m. (hora de Bogotá; se cambia con `horaAvisoDiario`), llega un mensaje con los conteos del día anterior y 10 titulares de Israel y Palestina, alternando entre medios.

---

## Personalizar

**Agregar o quitar fuentes** · `config/fuentes.json`

```json
{
  "id": "mi-fuente",
  "nombre": "Nombre visible",
  "url": "https://ejemplo.com/feed.xml",
  "sitio": "https://ejemplo.com",
  "idioma": "es",
  "pais": "País",
  "tipo": "Diario / cadena pública / agencia…",
  "seccion": "israel | medio-oriente | mundo"
}
```

Para apagar una fuente sin borrarla, agrega `"activa": false`.

**Cambiar las palabras clave** · `config/ajustes.json → secciones[0].palabrasClave`
- `empiezaCon`: coincide con el inicio de una palabra, sin importar tildes ni mayúsculas (`"palestin"` encuentra *palestino*, *Palestina*, *Palestinian*).
- `exactas`: solo la palabra completa (`"idf"`).

**Agregar otra sección temática** (por ejemplo Colombia): añade antes de `medio-oriente` un objeto con `id`, `nombre` y `palabrasClave`, y un color en `src/plantillas/estilos.css` (`.punto-colombia`).

**Cambiar la frecuencia** · `.github/workflows/monitor.yml` → `cron`. La hora del cron va en UTC. Ejemplos: `"17 * * * *"` cada hora, `"17 */4 * * *"` cada 4 horas.

**Cambiar el diseño** · edita `src/plantillas/estilos.css` o `src/plantillas/paginas.js` y luego corre `npm run reporte:todo` para regenerar todos los días.

---

## Probarlo en tu computador

Requiere Node.js 22 o más reciente.

```bash
npm install
npm run recolectar   # revisa las fuentes
npm run reporte      # genera reportes/ y docs/
```

Abre `docs/index.html` en el navegador. Para probar Telegram:

```bash
TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=123 node src/notificar.js --forzar
```

---

## Estructura

```
config/
  fuentes.json           medios y sus feeds
  ajustes.json           zona horaria, secciones, palabras clave, hora del aviso
src/
  recolectar.js          paso 1: lee feeds y guarda noticias nuevas
  reporte.js             paso 2: Markdown + página web
  notificar.js           paso 3: aviso diario por Telegram (opcional)
  lib/                   lectura de feeds y utilidades
  plantillas/            HTML, CSS y JS de la página
data/                    (automático) noticias por día y estado de cada fuente
reportes/                (automático) un .md por día
docs/                    (automático) la página que publica Vercel
vercel.json              le dice a Vercel que publique docs/ tal cual
.github/workflows/       la programación en GitHub Actions
```

---

## Bueno saber

- **Fuentes que fallan.** Algunos medios bloquean de vez en cuando las peticiones automáticas o cambian la dirección de su feed. El proyecto sigue con las demás, lo avisa en la página («X fuentes no respondieron») y en el Markdown, y lo reintenta en la siguiente ejecución. Si una falla por días, revisa su URL o desactívala.
- **Horarios aproximados.** GitHub puede retrasar los workflows programados unos minutos (a veces más en horas de mucho tráfico).
- **Inactividad.** GitHub puede pausar los workflows programados de repositorios sin actividad durante 60 días. Si pasa, se reactiva con un clic en la pestaña *Actions*.
- **Duplicados.** Se eliminan por enlace (ignorando `utm_*` y otros parámetros de rastreo) y por titular dentro del mismo sitio.
- **Fechas.** Las noticias se agrupan por día y hora de Bogotá. Las que llegan sin fecha usan la hora en que se detectaron; las de más de 36 horas se ignoran.
- **Contenido.** Se guardan solo titular, un resumen corto (el que el medio publica en su feed) y el enlace. Para leer la noticia completa siempre se va al sitio del medio.
- **Balance.** La lista combina medios israelíes de distintas líneas editoriales con medios públicos e internacionales de Europa, Estados Unidos, Catar y la ONU. Ningún medio es neutral en todo: el reporte sirve para comparar cómo cubre cada uno la misma historia.

## Fuentes incluidas

| Medio | País | Idioma | Sección base |
|---|---|---|---|
| The Times of Israel | Israel | EN | Israel y Palestina |
| The Jerusalem Post | Israel | EN | Israel y Palestina |
| Haaretz | Israel | EN | Israel y Palestina |
| Ynetnews | Israel | EN | Israel y Palestina |
| Israel Hayom | Israel | EN | Israel y Palestina |
| The Guardian · Israel | Reino Unido | EN | Israel y Palestina |
| BBC News · Medio Oriente | Reino Unido | EN | Medio Oriente |
| The New York Times · Medio Oriente | Estados Unidos | EN | Medio Oriente |
| France 24 · Medio Oriente | Francia | EN | Medio Oriente |
| Noticias ONU · Medio Oriente | Internacional | EN | Medio Oriente |
| Al Jazeera English | Catar | EN | Mundo |
| BBC News · World | Reino Unido | EN | Mundo |
| The Guardian · World | Reino Unido | EN | Mundo |
| DW News | Alemania | EN | Mundo |
| BBC Mundo | Reino Unido | ES | Mundo |
| DW Español | Alemania | ES | Mundo |
| France 24 Español | Francia | ES | Mundo |
| El País · Internacional | España | ES | Mundo |
