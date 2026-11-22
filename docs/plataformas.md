# Plataformas

## Estado

| Plataforma | Estado | Cómo se integra | Dificultad estimada |
|---|---|---|---|
| [GetOnBoard](https://www.getonbrd.com) | ✅ Integrada | API pública JSON | — |
| [Computrabajo](https://co.computrabajo.com) | ✅ Integrada | HTML renderizado en el servidor + detalle de cada vacante nueva | — |
| [LinkedIn](https://www.linkedin.com/jobs) | ✅ Empleos | Endpoint público de invitados (sin login) + detalle, con cupo de peticiones | — |
| LinkedIn (publicaciones "estamos contratando") | Por decidir | La búsqueda de publicaciones exige sesión; ver abajo | — |
| [elempleo](https://www.elempleo.com/co/) | ✅ Integrada | API JSON del sitio con token de la sesión anónima | — |
| [Torre](https://torre.ai) | 🚫 Descartada | Hace lo mismo que JobFilter y muchas de sus vacantes vienen de otros portales; ver abajo | — |
| [PeakU](https://peaku.co) | ✅ Integrada | API pública del sitio + JSON-LD de cada vacante | — |
| [Hireline](https://hireline.io/co) | ✅ Integrada | HTML renderizado en el servidor + JSON-LD de cada vacante | — |
| [Magneto365](https://www.magneto365.com/co) | ✅ Integrada | API pública del sitio, con la descripción completa en el listado | — |
| [Talently](https://talently.tech/trabajos) | ✅ Integrada | API pública del sitio: el listado completo en una petición | — |

Cada plataforma ya tiene su color reservado en `src/lib/platforms.ts`.

¿Quieres integrar una? Abre un issue con la plantilla **Nueva plataforma** para coordinar y
que nadie trabaje dos veces en lo mismo.

## Lo que se sabe de cada una

Sondeo hecho sin login y con un User-Agent de navegador (octubre de 2026):

- **GetOnBoard**: `https://www.getonbrd.com/api/v0/search/jobs?query=<texto>&per_page=100&page=N&expand=["company","location_cities","location_tenants"]`.
  Devuelve de la más nueva a la más vieja. Trae idioma (`lang`), modalidad
  (`remote_modality`: `fully_remote`, `remote_local`, `hybrid`, `no_remote`), países
  permitidos para remoto (`location_tenants`) y ciudades. Busca el texto también en la
  descripción, así que trae ruido; el mapa de calor lo compensa.
- **LinkedIn (empleos)**: endpoint público de invitados, el mismo que usa la página de
  empleos sin sesión. Sin login ni cookies.
  - Búsqueda: `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=<texto>&location=<lugar>&f_TPR=r<segundos>&f_WT=2&start=<offset>`.
    `location` acepta "Colombia" o "Barranquilla, Colombia" (y trae ciudades cercanas);
    `f_WT=2` es remoto; `f_TPR` filtra por antigüedad en segundos. 10 tarjetas por página,
    `start` avanza de 10 en 10. `sortBy=DD` no ordena de verdad por fecha.
  - Cada tarjeta trae id (`urn:li:jobPosting:<id>`), título, empresa, ubicación y la fecha
    exacta (`<time datetime="2026-10-13">`). La URL limpia es `/jobs/view/<id>/`.
  - Detalle: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/<id>`, con la
    descripción (`show-more-less-html__markup`) y criterios (nivel, tipo de empleo, sector).
  - **Límites**: el bloqueo es por volumen de peticiones por IP, no por velocidad. JobSpy
    espera 3 a 7 s entre páginas y otros proyectos 2 s sin problemas, mientras que con 15 a
    25 s igual llegaba el 429: la causa era la cantidad de peticiones (sobre todo de
    detalle) y las corridas seguidas que reabrían la penalización. Scrapfly midió `999` tras
    50–60 peticiones en 15 minutos, con o sin cookies. (Investigación de octubre de 2026:
    [JobSpy](https://github.com/speedyapply/JobSpy),
    [Scrapfly](https://scrapfly.io/blog/posts/best-linkedin-scrapers-github),
    [reintentos ante 429](https://github.com/danielcanfly/jobs-scraper/pull/8),
    [detalle como causa](https://github.com/Uzzoper/job-hunter/issues/99).)
  - Por eso el adapter:
    - pide el detalle **solo si el título menciona alguna palabra clave** del perfil
      (`prefilterByTitle`), porque el detalle es lo que más carga;
    - no manda cookies (`cookies: false`), igual que JobSpy;
    - va a 4–8 s entre peticiones (medidos desde cada respuesta), con un cupo duro de 25 por
      búsqueda que incluye reintentos (`maxRequestsPerRun`);
    - no sigue redirecciones: una redirección al muro de login (`authwall`) cuenta como
      bloqueo (`blockRedirects`), igual que un detalle que llega sin descripción;
    - tiene un freno: al menos 30 minutos entre corridas (`minGapMinutes`) y cada palabra
      clave como mucho una vez por semana (`refreshEveryHours`);
    - ante un 429 espera 75 s y reintenta una vez para terminar lo que estaba en curso, y
      corta la búsqueda con una pausa corta (`blockRetryMs`); si ya venía de un bloqueo, no
      reintenta. Ante un bloqueo, se pausa 30 minutos, 2 horas, 8 horas y 1 día
      (`pauseMinutes`), y cualquier otro error también la pausa (`pauseOnErrors`).
  - No sirven (sin evidencia o con evidencia en contra): cabeceras `csrf-token`, cookies
    especiales, rotar el User-Agent, imitar la huella del navegador. Usar un navegador no
    cambia el volumen por IP, que es lo que LinkedIn mide. La página pública `/jobs/view`
    muestra muro de login a visitantes sin sesión desde octubre de 2026.
  - Unas 6 de cada 10 vacantes remotas de Colombia están en inglés: las filtra el detector de
    idioma de la búsqueda.
- **LinkedIn (publicaciones)**: las publicaciones de reclutadores ("estamos contratando") no
  se pueden buscar sin sesión. Una publicación sí se lee sin login si se tiene su link (trae
  `SocialMediaPosting` en JSON-LD con texto, autor y fecha), pero encontrarlas es el problema:
  DuckDuckGo y Bing responden con captcha a búsquedas automáticas, y la API de búsqueda de
  Google está cerrada a clientes nuevos. Opciones abiertas: un modo asistido (JobFilter abre la
  búsqueda en tu navegador y tú pegas los links que te sirvan) o una API de búsqueda de pago.
  Usar una sesión de LinkedIn queda descartado por el riesgo para la cuenta.
- **Computrabajo**: un subdominio por país con el mismo formato (`co`, `mx`, `pe`, `ar`,
  `cl`, `ec`, `ve`, `bo`, `py`, `uy`, `gt`, `sv`, `hn`, `ni`, `cr`, `pa`, `do`); el adapter
  elige según `location.country`.
  - Búsqueda: `https://co.computrabajo.com/trabajo-de-<término>-en-<lugar>?by=publicationtime&pubdate=<días>&p=<página>`.
    `<lugar>` es `remoto` o el slug de la ciudad (`barranquilla`, `bogota`); el slug del
    término quita tildes y puntos (`node.js` → `node-js`).
  - `pubdate` acepta 1, 3, 7, 15 o 30 días; `by=publicationtime` ordena por fecha (no
    estricto). 20 vacantes por página; el total viene en el `<h1>`.
  - Cada tarjeta es un `<article class="box_offer" data-id="…">` con título, empresa (link a
    su perfil; sin link es confidencial: "Importante empresa del sector"), ubicación, fecha
    ("Hace 3 horas", "Ayer", "Hace 5 días", "14 de septiembre" o "Más de 30 días") y etiquetas `Remoto` o `Presencial y
    remoto` (híbrido).
  - La tarjeta no trae la descripción: se pide la página de la vacante solo para las nuevas
    (bloque "Descripción de la oferta", que incluye requisitos y conocimientos).
  - La búsqueda por ciudad cuela algunas de otras ciudades: el adapter vuelve a filtrar con
    la ubicación de cada tarjeta.
  - Busca por sinónimos: "tech lead" en Barranquilla trae 72 resultados, entre ellos
    "Director Técnico Farmacéutico". El adapter declara `looseSearch: true` y la búsqueda
    solo guarda las que mencionan el término en el título o la descripción, con sus palabras
    en orden y cerca (en una prueba real, eso descartó 148 de 180).
- **elempleo** (solo Colombia): la página de ofertas renderiza las primeras 20 vacantes, pero
  pagina con su API JSON. El adapter usa esa API:
  - `GET https://www.elempleo.com/co/ofertas-empleo/` trae el token antifalsificación (input
    `__RequestVerificationToken` dentro de `.js-search-api-token`), una cookie de sesión
    anónima y la lista de ciudades con su id (`data-cities-val`; Barranquilla = 2,
    Bogotá = 34). Una vez por búsqueda.
  - `POST https://www.elempleo.com/co/api/joboffers/findbyfilter` con el token en el header
    `__RequestVerificationToken` y un JSON con `query`, `workModality` (101 = remoto),
    `cities` (ids), `publishDate` (1 = hoy y ayer, 2 = una semana, 3 = dos semanas, 4 = un
    mes), `pageIndex`, `pageSize` (20, 50 o 100) y `sortExpression: "PublishDate_Desc"`.
  - Cada resultado trae id, título, empresa (`notConfidential: false` = confidencial), ciudad,
    modalidad (`idworkmodalitytxt`), fecha exacta (`publishDate`), URL y la descripción
    completa. No hace falta pedir detalle.
  - Busca por palabras sueltas ("desarrollador fullstack" da cerca de 500 resultados) y
    guarda vacantes de hasta 5 meses atrás: se filtran por relevancia y por fecha.
  - La página trae un formulario con reCAPTCHA: no es un desafío, y el detector de captcha ya
    lo distingue.
- **PeakU**: su web (Nuxt) consume una API pública sin login.
  - Listado: `GET https://api.peaku.co/api-v2/get-active-jobs?start=<n>&step=<n>&text=<texto>`
    (también acepta `location_generic_type_codes` y `city_id`). En octubre de 2026 había solo
    **83 vacantes activas** en total, así que el adapter trae el listado completo una vez por
    búsqueda (`step=100`) y filtra localmente.
  - Cada vacante trae `url` (`57876-mobile-application-developer…`, el número es el id),
    título, empresa (`confidential`), ciudad, `location_type.code` (`RA` remoto en cualquier
    lugar, `RC` remoto en el país, `H` híbrido, `OS` presencial), `all_countries` (para `RC`;
    a veces vacío), habilidades principales y las fechas `created_at` y `last_activated_at`.
  - Detalle: `https://peaku.co/es/empleos/<url>` trae un JSON-LD `JobPosting` con la
    descripción en HTML **escapado como entidades** (`&lt;h2&gt;`). Algunas vacantes no lo
    traen: se guardan sin descripción y el mapa de calor usa solo el título.
  - El estado `window.__NUXT__` es código JavaScript minificado: no se ejecuta, se usan la API
    y el JSON-LD.
- **Hireline** (Colombia `/co`, México `/mx`): HTML renderizado en el servidor, sin login.
  - Listado: `https://hireline.io/co/empleos?k=<texto>&l=&jk=&sal=&jd=<fecha>&page=<n>`
    (`jd`: 1 = dos semanas, 2 = un mes, 3 = dos meses). 12 vacantes por página; en octubre
    de 2026 había **29 activas** en Colombia, así que el adapter trae el listado completo
    (`k=` vacío) una vez por búsqueda y filtra localmente.
  - Cada tarjeta es un `<a class="hl-vacancy-card" href=".../empleos/<slug>/<id>">` con fecha
    relativa ("Hace un día.", "Hace más de 30 días."), título con la empresa al final ("…
    en Kyndryl México"), salario, resumen, ubicación ("Remoto: LATAM", "Remoto: México,
    Colombia", "Bogota - Híbrido") y tipo de empleo.
  - Detalle: JSON-LD `JobPosting` con título, `hiringOrganization`, `datePosted`, descripción
    completa y `jobLocationType`. Su `applicantLocationRequirements` parece venir por defecto
    en México aunque la tarjeta diga LATAM: para la ubicación se usa la tarjeta.
- **Magneto365** (Colombia): Next.js. Las páginas de búsqueda y de cada vacante se renderizan
  en el servidor y en octubre de 2026 daban 504 a los 10 segundos; solo la portada (`/co`)
  responde, porque está precargada. El sitio llama a una API pública, sin login, que sí
  responde rápido:
  - Búsqueda: `https://api.magneto365.com/jobs/v1/public/jobs/search` con los parámetros
    `device=desktop`, `paginator[page]=<n>`, `paginator[pageSize]=30` (solo acepta 20 o 30),
    `order[field]=publish_date`, `order[order]=DESC`, `queries[0][field]=all` y
    `queries[0][term]=<texto>`. Ignora `q`. Sin `queries` devuelve todas las vacantes
    (unas 370.000).
  - Filtros: `filters[locations][0]` con el país (`C47` es Colombia) o una ciudad
    (`CT17028` es Barranquilla), y `filters[work_modality][i]` con `remote`, `hybrid` u
    `onSite`. `city_id` y `country_id` dan 400; `publish_date` no filtra.
  - El id de la ciudad sale del autocompletado:
    `https://api.magneto365.com/jobs/v1/public/locations?term=<ciudad>&country_id=47`.
  - Cada vacante trae id, `jobSlug` (la URL es `https://www.magneto365.com/co/empleos/<jobSlug>`),
    título, empresa (`confidential`), ciudades, fecha exacta (`publishDate`), habilidades,
    nivel de estudios y la descripción completa en HTML: es la misma que la del detalle
    (`/v1/public/jobs/<jobSlug>`), así que no se pide.
  - `isRemote` vale `true` para remoto y para híbrido. El adapter busca remoto en el país y
    presencial o híbrido en la ciudad por separado, y en la segunda usa `isRemote` para
    distinguir híbrido de presencial.
  - Algunas agencias le agregan su código interno al título ("Desarrollador/a PHP
    1626256994-158"). El adapter lo quita, para que la misma vacante republicada tenga el
    mismo título.
  - Busca también en la descripción ("desarrollador" trae "desarrollo de negocios"), así que
    el adapter usa `looseSearch`.
- **Torre**: **descartada** (octubre de 2026). Torre ya hace lo que hace JobFilter: analiza tu
  CV y te filtra las vacantes según tu perfil. Además, buena parte de su listado no es propio:
  sus términos dicen que, salvo las publicaciones pagas o destacadas, las vacantes se
  "indexan o publican de forma automática", y en la práctica parece un envoltorio de LinkedIn,
  que ya está integrado. Integrarla traería sobre todo vacantes repetidas. Lo que se encontró,
  por si alguien la retoma:
  - La búsqueda pública está cerrada: `POST https://search.torre.co/opportunities/_search/`
    responde 400 a cualquier cuerpo, y la web nueva (Flutter) busca con sesión. El
    `robots.txt` prohíbe `/api/`.
  - Los sitemaps (`https://torre.ai/sitemap-index.xml`) listan las vacantes activas por idioma
    (`sitemap-es-N`, `sitemap-en-N`; 748 en español) como
    `https://torre.ai/post/<id>-<empresa>-<título>`, con fecha de modificación. Cada página
    trae un JSON-LD `JobPosting` completo, sin sesión.
  - La API de reclutadores (`https://api.torre.ai/v1/openapi.json`) usa claves creadas desde la
    cuenta y tiene `GET /v1/jobs/{jobId}`: gratis y sin ser dueño de la vacante, pero sin
    búsqueda. La API para profesionales, que sí consulta vacantes, sigue en private beta
    ([torre.ai/apiforprofessionals](https://torre.ai/apiforprofessionals)).
  - Sus términos prohíben "spider, crawl, or scrape the Content".
- **Talently**: Nuxt. La bolsa de empleo está en `/trabajos` (`/empleos`, `/ofertas` y `/jobs`
  dan 404), con filtros en la ruta: `/trabajos/rol-fullstack-developer/modalidad-remoto-global`.
  - La página carga las vacantes de una API pública, sin login:
    `https://admin.talently.tech/api/v4/web/work-offers/search?page=<n>&per_page=<m>`.
    Acepta `per_page=100`; en octubre de 2026 había **43 vacantes activas**, así que el
    adapter trae el listado completo en **una sola petición** por búsqueda, para todas las
    palabras clave, y filtra localmente.
  - Cada vacante trae id, `public_url` (la URL es `https://talently.tech/oferta/<public_url>`;
    `slug` da 404), título, empresa (`business.name`, `null` si `is_confidential`), país,
    ciudad, fecha exacta (`published_at`), rol (`developer_type`), tecnologías (`stacks`) y
    las responsabilidades y requisitos en markdown con entidades HTML (`&amp;`).
    `description` viene vacío o como `<p>null</p>`.
  - `work_modality.id`: 1 = Remoto Global (cualquier país), 4 = Remoto local (solo el país de
    la vacante), 2 = Híbrido, 3 = Presencial.
  - El campo `language` no es confiable (hay vacantes en inglés marcadas `es`): el idioma lo
    decide la detección por la descripción, como en las demás plataformas.
  - El detalle (`/v4/web/offers/<public_url>`) no agrega nada que se use, así que no se pide.
  - Sus términos prohíben el scraping y la extracción masiva de datos. Una petición por
    búsqueda queda lejos de eso, pero aplica el aviso de uso personal del README.

## Agregar una plataforma

### 1. Investiga y guarda fixtures

Busca cómo trae el sitio las vacantes sin iniciar sesión: una API (pestaña *Network* del
navegador), HTML renderizado en el servidor o un estado embebido (`__NEXT_DATA__`,
`__NUXT__`). Anota:

- URL de búsqueda, parámetros y paginación.
- Si se puede filtrar por fecha y en qué orden vienen los resultados.
- Qué campos trae: empresa, quién publica, fecha (exacta o relativa: "hace 3 días"),
  ubicación, modalidad, idioma, descripción.

Guarda una o dos respuestas reales en `fixtures/<plataforma>/` para desarrollar el parser sin
pegarle al sitio en cada prueba.

### 2. Escribe el adapter

Crea `src/lib/server/features/search/adapters/<plataforma>.ts`:

```ts
import { htmlToText, samePlace } from '#lib/server/shared/normalize';
import type { PlatformAdapter, RawPosting } from './types';

export const miPlataforma: PlatformAdapter = {
	id: 'miplataforma', // el mismo id que en src/lib/platforms.ts
	name: 'Mi Plataforma',
	delay: { min: 4_000, max: 12_000 }, // pausa aleatoria entre peticiones, en ms

	async *search(term, { client, since, location }) {
		for (let page = 1; page <= 10; page++) {
			const html = await client.text(`https://.../buscar?q=${encodeURIComponent(term)}&page=${page}`);
			const items = parse(html); // tu parser

			let reachedOld = false;
			for (const item of items) {
				if (item.publishedAt < since) {
					reachedOld = true;
					continue;
				}
				// filtra por location.country / location.city / location.languages
				if (!item.remote && !samePlace(item.city, location.city)) continue;
				yield item satisfies RawPosting;
			}
			if (reachedOld || items.length === 0) return;
		}
	}
};
```

Si el listado no trae la descripción, implementa también `fetchDetail(posting, ctx)`: la
búsqueda lo llama solo para las vacantes que todavía no están en la base, así que cuesta una
petición por vacante nueva y nada en las búsquedas siguientes.

Si la plataforma devuelve resultados que no mencionan lo que buscaste (sinónimos, búsqueda
"inteligente"), declara `looseSearch: true`: la búsqueda descarta las vacantes cuyo título y
descripción no mencionan el término (sus palabras en orden y con hasta 2 palabras entre
una y otra).

Si la plataforma corta rápido con 429 (como LinkedIn), tienes estas opciones en el adapter:

- `maxRequestsPerRun`: cada búsqueda hace como mucho esa cantidad de peticiones; las palabras
  clave que falten siguen en la próxima, gracias al cursor por palabra.
- `prefilterByTitle`: el detalle se pide solo si el título menciona alguna palabra clave.
- `blockRetryMs`: ante un 429, esperar y reintentar una vez antes de rendirse.
- `pauseMinutes`: escalera de pausas ante bloqueos seguidos (por defecto 1 día, 2, 4 y una
  semana).
- `cookies: false`: no devolver las cookies de la sesión anónima.
- `blockRedirects`: no seguir redirecciones; cualquier redirección cuenta como bloqueo.
- `pauseOnErrors`: cualquier error que corte la búsqueda pausa la plataforma, no solo un
  bloqueo.
- `minGapMinutes` y `refreshEveryHours`: freno contra apretar Buscar muchas veces (minutos
  mínimos entre corridas, y cada cuántas horas se puede volver a buscar cada palabra).

Reglas del adapter:

- Solo traduce y filtra. No guarda nada: de eso se encarga la búsqueda.
- Usa siempre `ctx.client`: ya maneja pausas, reintentos y bloqueos (un 429, un 403 o un
  captcha pausan la plataforma 24 h).
- Corta la paginación en cuanto llegue a vacantes anteriores a `since`.
- Si la fecha viene como texto ("Hace 3 días", "14 de septiembre"), conviértela con
  `parsePublishedDate` de `#lib/server/shared/relative-date` y guarda el texto original en
  `publishedRaw`. Si la fecha es solo un tope ("Más de 30 días") o no se entiende, marca
  `publishedApprox: true`: así no se confunde con una republicación.
- Exporta las funciones de parseo por separado (como `parseSearchPage` y `parseDetail` en
  `computrabajo.ts`) para poder probarlas contra los fixtures.
- Nunca inicies sesión ni uses cookies de una cuenta.

### 3. Regístrala

Agrégala al arreglo de `src/lib/server/features/search/adapters/index.ts`. Si su id no está
en `src/lib/platforms.ts`, agrégalo con un tono que se distinga de los demás.

### 4. Prueba

Escribe `<plataforma>.test.ts` junto al adapter, con tests del parser contra tus fixtures
(`computrabajo.test.ts` sirve de ejemplo). No hagas peticiones reales en los tests.

```sh
bun run test      # tests de los parsers
bun run check     # tipos
bun run buscar    # una búsqueda real desde la terminal
```

Revisa que una segunda búsqueda no traiga duplicados y que los filtros de ubicación e
idioma funcionen.
